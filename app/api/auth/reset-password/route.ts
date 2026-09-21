import { NextResponse } from "next/server";
import { env } from "cloudflare:workers";
import {
  assertSameOrigin,
  createSession,
  hashPassword,
  normalizeEmail,
  setSessionCookie,
  sha256,
  validatePassword,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return NextResponse.json({ error: "无效的请求来源" }, { status: 403 });
  if (!env.DB) return NextResponse.json({ error: "数据库暂时不可用" }, { status: 503 });
  const body = await request.json() as { email?: string; code?: string; password?: string };
  const email = normalizeEmail(body.email ?? "");
  const code = (body.code ?? "").trim().toUpperCase();
  const password = body.password ?? "";
  const passwordError = validatePassword(password);
  if (passwordError) return NextResponse.json({ error: passwordError }, { status: 400 });

  const reset = await env.DB.prepare(
    `SELECT resets.code_hash AS codeHash, users.id AS userId
     FROM password_reset_codes resets
     JOIN app_users users ON users.id = resets.user_id
     WHERE users.email = ? AND resets.code_hash = ? AND resets.expires_at > ? AND users.disabled = 0
     LIMIT 1`,
  ).bind(email, await sha256(code), new Date().toISOString()).first<{ codeHash: string; userId: string }>();
  if (!reset) return NextResponse.json({ error: "重置码无效或已经过期" }, { status: 400 });

  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare("UPDATE app_users SET password_hash = ?, updated_at = ? WHERE id = ?").bind(await hashPassword(password), now, reset.userId),
    env.DB.prepare("DELETE FROM password_reset_codes WHERE user_id = ?").bind(reset.userId),
    env.DB.prepare("DELETE FROM auth_sessions WHERE user_id = ?").bind(reset.userId),
  ]);
  const session = await createSession(reset.userId);
  const response = NextResponse.json({ ok: true });
  setSessionCookie(response, session.token, session.expiresAt);
  return response;
}
