import { NextResponse } from "next/server";
import { env } from "cloudflare:workers";
import {
  assertSameOrigin,
  createSession,
  hashPassword,
  isOwnerEmail,
  normalizeEmail,
  setSessionCookie,
  validatePassword,
} from "@/lib/auth";
import { loadSharedTrip } from "@/db/trips";
import { normalizeTripSnapshot } from "@/lib/trip-data";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return NextResponse.json({ error: "无效的请求来源" }, { status: 403 });
  if (!env.DB) return NextResponse.json({ error: "数据库暂时不可用" }, { status: 503 });

  const body = await request.json() as { email?: string; password?: string; displayName?: string };
  const email = normalizeEmail(body.email ?? "");
  const password = body.password ?? "";
  const displayName = (body.displayName ?? "").trim().slice(0, 60) || email.split("@")[0];
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "请输入有效邮箱" }, { status: 400 });
  const passwordError = validatePassword(password);
  if (passwordError) return NextResponse.json({ error: passwordError }, { status: 400 });

  const owner = isOwnerEmail(email);
  if (!owner) {
    const stored = await loadSharedTrip();
    const trip = stored ? normalizeTripSnapshot(stored.trip) : null;
    const invited = trip?.members.some((member) => member.email && normalizeEmail(member.email) === email);
    if (!invited) return NextResponse.json({ error: "该邮箱尚未被旅行管理员邀请" }, { status: 403 });
  }

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
}
