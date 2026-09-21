import { cookies, headers } from "next/headers";
import { env } from "cloudflare:workers";
import type { NextResponse } from "next/server";

const SESSION_COOKIE = "travel_session";
const SESSION_DAYS = 30;
// Cloudflare Workers currently caps PBKDF2 at 100,000 iterations.
const PASSWORD_ITERATIONS = 100_000;

export type AppUser = {
  userId: string;
  email: string;
  displayName: string;
  role: "owner" | "member";
};

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

async function derivePassword(password: string, salt: Uint8Array) {
  const saltBuffer = new Uint8Array(salt).buffer;
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: saltBuffer, iterations: PASSWORD_ITERATIONS },
    material,
    256,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const derived = await derivePassword(password, salt);
  return `pbkdf2-sha256$${PASSWORD_ITERATIONS}$${bytesToBase64(salt)}$${bytesToBase64(derived)}`;
}

export async function verifyPassword(password: string, encoded: string) {
  const [algorithm, iterations, saltValue, hashValue] = encoded.split("$");
  if (algorithm !== "pbkdf2-sha256" || Number(iterations) !== PASSWORD_ITERATIONS || !saltValue || !hashValue) return false;
  try {
    const derived = await derivePassword(password, base64ToBytes(saltValue));
    return constantTimeEqual(derived, base64ToBytes(hashValue));
  } catch {
    return false;
  }
}

export async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToBase64(new Uint8Array(digest));
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function isOwnerEmail(email: string) {
  return Boolean(env.OWNER_EMAIL && normalizeEmail(email) === normalizeEmail(env.OWNER_EMAIL));
}

export function validatePassword(password: string) {
  if (password.length < 6) return "密码至少需要 6 个字符";
  if (password.length > 128) return "密码不能超过 128 个字符";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "密码需要同时包含字母和数字";
  return null;
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function createSession(userId: string) {
  if (!env.DB) throw new Error("数据库暂时不可用");
  const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
  const token = bytesToBase64(tokenBytes).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  const tokenHash = await sha256(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString();
  await env.DB.prepare(
    "INSERT INTO auth_sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
  ).bind(tokenHash, userId, expiresAt, new Date().toISOString()).run();
  return { token, expiresAt };
}

export function setSessionCookie(response: NextResponse, token: string, expiresAt: string) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });
}

export async function getAppUser(): Promise<AppUser | null> {
  const requestHeaders = await headers();

  // Keep the existing Sites preview identity working while Cloudflare uses its own session cookie.
  const sitesUserId = requestHeaders.get("oai-authenticated-user-id");
  const sitesEmail = requestHeaders.get("oai-authenticated-user-email");
  if (sitesUserId && sitesEmail) {
    return {
      userId: sitesUserId,
      email: sitesEmail,
      displayName: requestHeaders.get("oai-authenticated-user-full-name") ?? sitesEmail,
      role: isOwnerEmail(sitesEmail) ? "owner" : "member",
    };
  }

  if (!env.DB) return null;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const tokenHash = await sha256(token);
  const row = await env.DB.prepare(
    `SELECT users.id AS userId, users.email, users.display_name AS displayName, users.role
     FROM auth_sessions sessions
     JOIN app_users users ON users.id = sessions.user_id
     WHERE sessions.token_hash = ? AND sessions.expires_at > ? AND users.disabled = 0
     LIMIT 1`,
  ).bind(tokenHash, new Date().toISOString()).first<AppUser>();
  return row ?? null;
}

export async function deleteCurrentSession() {
  if (!env.DB) return;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return;
  await env.DB.prepare("DELETE FROM auth_sessions WHERE token_hash = ?").bind(await sha256(token)).run();
}
