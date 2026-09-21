import { NextResponse } from "next/server";
import { env } from "cloudflare:workers";
import { assertSameOrigin, getAppUser, isOwnerEmail, sha256 } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function requireOwner() {
  const user = await getAppUser();
  return user && (user.role === "owner" || isOwnerEmail(user.email)) ? user : null;
}

function resetCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const values = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join("");
}

export async function GET() {
  const owner = await requireOwner();
  if (!owner) return NextResponse.json({ error: "仅创建者可以查看后台" }, { status: 403 });
  if (!env.DB) return NextResponse.json({ error: "数据库暂时不可用" }, { status: 503 });
  const result = await env.DB.prepare(
    `SELECT users.id, users.email, users.display_name AS displayName, users.role,
            users.disabled, users.created_at AS createdAt, users.last_login_at AS lastLoginAt,
            COUNT(sessions.token_hash) AS activeSessions, MAX(sessions.expires_at) AS sessionExpiresAt
     FROM app_users users
     LEFT JOIN auth_sessions sessions ON sessions.user_id = users.id AND sessions.expires_at > ?
     GROUP BY users.id
     ORDER BY users.created_at ASC`,
  ).bind(new Date().toISOString()).all();
  return NextResponse.json({ users: result.results });
}

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return NextResponse.json({ error: "无效的请求来源" }, { status: 403 });
  const owner = await requireOwner();
  if (!owner) return NextResponse.json({ error: "仅创建者可以管理账号" }, { status: 403 });
  if (!env.DB) return NextResponse.json({ error: "数据库暂时不可用" }, { status: 503 });
  const body = await request.json() as { userId?: string; action?: "disable" | "enable" | "logout" | "reset" };
  const target = body.userId ? await env.DB.prepare("SELECT id, email, role FROM app_users WHERE id = ? LIMIT 1").bind(body.userId).first<{ id: string; email: string; role: string }>() : null;
  if (!target) return NextResponse.json({ error: "账号不存在" }, { status: 404 });
  if (target.id === owner.userId && body.action === "disable") return NextResponse.json({ error: "不能禁用当前创建者账号" }, { status: 400 });

  if (body.action === "disable" || body.action === "enable") {
    await env.DB.prepare("UPDATE app_users SET disabled = ?, updated_at = ? WHERE id = ?")
      .bind(body.action === "disable" ? 1 : 0, new Date().toISOString(), target.id).run();
    if (body.action === "disable") await env.DB.prepare("DELETE FROM auth_sessions WHERE user_id = ?").bind(target.id).run();
    return NextResponse.json({ ok: true });
  }
  if (body.action === "logout") {
    await env.DB.prepare("DELETE FROM auth_sessions WHERE user_id = ?").bind(target.id).run();
    return NextResponse.json({ ok: true });
  }
  if (body.action === "reset") {
    const code = resetCode();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 60_000).toISOString();
    await env.DB.batch([
      env.DB.prepare("DELETE FROM password_reset_codes WHERE user_id = ?").bind(target.id),
      env.DB.prepare("INSERT INTO password_reset_codes (code_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)")
        .bind(await sha256(code), target.id, expiresAt, now.toISOString()),
    ]);
    return NextResponse.json({ ok: true, resetCode: code, expiresAt });
  }
  return NextResponse.json({ error: "不支持的账号操作" }, { status: 400 });
}
