import { NextResponse } from "next/server";
import { env } from "cloudflare:workers";
import { authAllowed } from "@/lib/free-limits";
import {
  assertSameOrigin,
  createSession,
  hashPassword,
  isOwnerEmail,
  normalizeEmail,
  setSessionCookie,
  validatePassword,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    if (!assertSameOrigin(request)) return NextResponse.json({ error: "无效的请求来源" }, { status: 403 });
    if (!env.DB) return NextResponse.json({ error: "数据库暂时不可用" }, { status: 503 });
    if (!await authAllowed(request)) return NextResponse.json({error:"操作过快，请稍后再试"},{status:429});
    const count=await env.DB.prepare("SELECT COUNT(*) AS total FROM app_users").first<{total:number}>();
    if ((count?.total||0)>=500) return NextResponse.json({error:"已达到免费版本账号上限"},{status:429});

    const body = await request.json() as { email?: string; password?: string; displayName?: string };
    const email = normalizeEmail(body.email ?? "");
    const password = body.password ?? "";
    const displayName = (body.displayName ?? "").trim().slice(0, 60) || email.split("@")[0];
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "请输入有效邮箱" }, { status: 400 });
    const passwordError = validatePassword(password);
    if (passwordError) return NextResponse.json({ error: passwordError }, { status: 400 });

    const owner = isOwnerEmail(email);

    const existing = await env.DB.prepare("SELECT id FROM app_users WHERE email = ? LIMIT 1").bind(email).first();
    if (existing) return NextResponse.json({ error: "该邮箱已经注册，请直接登录" }, { status: 409 });

    const userId = crypto.randomUUID();
    const now = new Date().toISOString();
    await env.DB.prepare(
      "INSERT INTO app_users (id, email, display_name, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).bind(userId, email, displayName, await hashPassword(password), owner ? "owner" : "member", now, now).run();
    const session = await createSession(userId);
    const response = NextResponse.json({ ok: true, user: { email, displayName, role: owner ? "owner" : "member" } });
    setSessionCookie(response, session.token, session.expiresAt);
    return response;
  } catch (error) {
    const errorId = crypto.randomUUID().slice(0, 8);
    console.error(`[auth-register:${errorId}]`, error);
    return NextResponse.json({ error: `注册服务暂时异常（错误编号：${errorId}）` }, { status: 500 });
  }
}
