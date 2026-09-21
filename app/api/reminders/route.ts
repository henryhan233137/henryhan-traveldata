import { NextResponse } from "next/server";
import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { loadSharedTrip, saveSharedTrip } from "@/db/trips";
import { normalizeTripSnapshot, type TripReminder } from "@/lib/trip-data";

export const dynamic = "force-dynamic";

function isOwner(email: string | undefined) {
  return Boolean(email && env.OWNER_EMAIL && email.toLowerCase() === env.OWNER_EMAIL.toLowerCase());
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "请先登录后编辑提醒" }, { status: 401 });
  const stored = await loadSharedTrip();
  if (!stored) return NextResponse.json({ error: "旅行档案暂时不可用" }, { status: 503 });
  const trip = normalizeTripSnapshot(stored.trip);
  const owner = isOwner(user.email);
  const member = trip.members.find((item) => item.email && item.email.toLowerCase() === user.email.toLowerCase()) ?? (owner ? trip.members[0] : null);
  if (!member) return NextResponse.json({ error: "当前邮箱还不是本次旅行成员" }, { status: 403 });

  const reminders = (await request.json()) as TripReminder[];
  if (!Array.isArray(reminders) || reminders.some((item) => !item.id || !item.text?.trim() || typeof item.done !== "boolean")) {
    return NextResponse.json({ error: "提醒事项数据不完整" }, { status: 400 });
  }

  const editableScopes = new Set(owner ? ["common", member.id] : [member.id]);
  const preserved = trip.preTripReminders.filter((item) => !editableScopes.has(item.scope));
  const submitted = reminders
    .filter((item) => editableScopes.has(item.scope))
    .map((item) => ({ ...item, text: item.text.trim(), scope: item.scope === "common" ? "common" : member.id }));
  const nextTrip = { ...trip, preTripReminders: [...preserved, ...submitted] };

  try {
    const result = await saveSharedTrip(nextTrip);
    return NextResponse.json({ ok: true, reminders: nextTrip.preTripReminders.filter((item) => item.scope === "common" || item.scope === member.id), ...result });
  } catch {
    return NextResponse.json({ error: "提醒事项同步失败，请稍后重试" }, { status: 503 });
  }
}

