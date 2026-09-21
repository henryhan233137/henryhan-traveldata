import { NextResponse } from "next/server";
import { env } from "cloudflare:workers";
import { assertSameOrigin, createSession, normalizeEmail, setSessionCookie, verifyPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return NextResponse.json({ error: "无效的请求来源" }, { status: 403 });
  if (!env.DB) return NextResponse.json({ error: "数据库暂时不可用" }, { status: 503 });
  const body = await request.json() as { email?: string; password?: string };
  const email = normalizeEmail(body.email ?? "");
  const password = body.password ?? "";
  const user = await env.DB.prepare(
    "SELECT id, email, display_name AS displayName, password_hash AS passwordHash, role, disabled FROM app_users WHERE email = ? LIMIT 1",
  ).bind(email).first<{ id: string; email: string; displayName: string; passwordHash: string; role: string; disabled: number }>();
  if (!user || user.disabled || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "邮箱或密码不正确" }, { status: 401 });
  }
  await env.DB.prepare("UPDATE app_users SET last_login_at = ?, updated_at = ? WHERE id = ?")
    .bind(new Date().toISOString(), new Date().toISOString(), user.id).run();
  const session = await createSession(user.id);
  const response = NextResponse.json({ ok: true, user: { email: user.email, displayName: user.displayName, role: user.role } });
  setSessionCookie(response, session.token, session.expiresAt);
  return response;
}
