import { NextResponse } from "next/server";
import { assertSameOrigin, clearSessionCookie, deleteCurrentSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return NextResponse.json({ error: "无效的请求来源" }, { status: 403 });
  await deleteCurrentSession();
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}
