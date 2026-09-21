import { NextResponse } from "next/server";
import { env } from "cloudflare:workers";
import { getAppUser } from "@/lib/auth";
import { loadSharedTrip, saveSharedTrip } from "@/db/trips";
import { normalizeTripSnapshot } from "@/lib/trip-data";

export const dynamic = "force-dynamic";

function isOwner(email: string | undefined) {
  return Boolean(email && env.OWNER_EMAIL && email.toLowerCase() === env.OWNER_EMAIL.toLowerCase());
}

export async function POST(request: Request) {
  const user = await getAppUser();
  if (!user) return NextResponse.json({ error: "请先登录后更新购票状态" }, { status: 401 });
  const stored = await loadSharedTrip();
  if (!stored) return NextResponse.json({ error: "旅行档案暂时不可用" }, { status: 503 });
  const trip = normalizeTripSnapshot(stored.trip);
  const member = trip.members.find((item) => item.email && item.email.toLowerCase() === user.email.toLowerCase());
  if (!member && !isOwner(user.email)) return NextResponse.json({ error: "当前邮箱还不是本次旅行成员" }, { status: 403 });

  const body = await request.json() as { dayIndex?: number; stopIndex?: number; done?: boolean };
  if (!Number.isInteger(body.dayIndex) || !Number.isInteger(body.stopIndex) || typeof body.done !== "boolean") {
    return NextResponse.json({ error: "购票状态数据不完整" }, { status: 400 });
  }
  const dayIndex = Number(body.dayIndex);
  const stopIndex = Number(body.stopIndex);
  const stop = trip.days[dayIndex]?.stops[stopIndex];
  if (!stop?.ticketRequired) return NextResponse.json({ error: "没有找到对应的购票项目" }, { status: 404 });
  const nextTrip = { ...trip, days: trip.days.map((day, currentDay) => currentDay === dayIndex ? { ...day, stops: day.stops.map((item, currentStop) => currentStop === stopIndex ? { ...item, ticketDone: body.done } : item) } : day) };
  try {
    const result = await saveSharedTrip(nextTrip);
    return NextResponse.json({ ok: true, done: body.done, ...result });
  } catch {
    return NextResponse.json({ error: "购票状态同步失败，请稍后重试" }, { status: 503 });
  }
}
