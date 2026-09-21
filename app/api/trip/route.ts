import { NextResponse } from "next/server";
import { env } from "cloudflare:workers";
import { getAppUser } from "@/lib/auth";
import { loadOwnerTrip, loadSharedTrip, saveOwnerTrip } from "@/db/trips";
import { defaultTrip, normalizeTripSnapshot, type TripSnapshot } from "@/lib/trip-data";

export const dynamic = "force-dynamic";

function isOwner(email: string | undefined) {
  return Boolean(email && env.OWNER_EMAIL && email.toLowerCase() === env.OWNER_EMAIL.toLowerCase());
}

function memberForEmail(trip: TripSnapshot, email: string | undefined) {
  if (!email) return null;
  return trip.members.find((item) => item.email && item.email.toLowerCase() === email.toLowerCase()) ?? null;
}

function tripForViewer(trip: TripSnapshot, memberId: string | null) {
  return {
    ...trip,
    preTripReminders: trip.preTripReminders.filter((item) => item.scope === "common" || item.scope === memberId),
  };
}

export async function GET() {
  const user = await getAppUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  try {
    if (user && isOwner(user.email)) {
      const trip = await loadOwnerTrip(user.userId);
      const normalized = normalizeTripSnapshot(trip ?? defaultTrip);
      const member = memberForEmail(normalized, user.email) ?? normalized.members[0] ?? null;
      return NextResponse.json({ trip: tripForViewer(normalized, member?.id ?? null), canEdit: true, canEditLedger: true, canEditReminders: true, canEditTickets: true, viewerMemberId: member?.id ?? null, email: user.email });
    }
    const stored = await loadSharedTrip();
    const trip = normalizeTripSnapshot(stored?.trip ?? defaultTrip);
    const member = memberForEmail(trip, user?.email);
    return NextResponse.json({ trip: tripForViewer(trip, member?.id ?? null), canEdit: false, canEditLedger: Boolean(member?.ledgerAccess), canEditReminders: Boolean(member), canEditTickets: Boolean(member), viewerMemberId: member?.id ?? null, email: user?.email });
  } catch {
    const owner = Boolean(user && isOwner(user.email));
    const member = memberForEmail(defaultTrip, user?.email) ?? (owner ? defaultTrip.members[0] : null);
    return NextResponse.json({ trip: tripForViewer(defaultTrip, member?.id ?? null), canEdit: owner, canEditLedger: owner, canEditReminders: Boolean(member), canEditTickets: Boolean(member), viewerMemberId: member?.id ?? null, email: user?.email, storageUnavailable: true });
  }
}

export async function POST(request: Request) {
  const user = await getAppUser();
  if (!user) return NextResponse.json({ error: "请先登录后保存" }, { status: 401 });
  if (!isOwner(user.email)) return NextResponse.json({ error: "当前账户只有查看权限" }, { status: 403 });
  const submitted = normalizeTripSnapshot((await request.json()) as TripSnapshot);
  if (!submitted?.title || !Array.isArray(submitted.days) || !Array.isArray(submitted.transports)) {
    return NextResponse.json({ error: "行程数据不完整" }, { status: 400 });
  }
  try {
    const stored = normalizeTripSnapshot((await loadSharedTrip())?.trip ?? defaultTrip);
    const member = memberForEmail(stored, user.email) ?? stored.members[0] ?? null;
    const allowedScopes = new Set(["common", member?.id].filter(Boolean));
    const hiddenReminders = stored.preTripReminders.filter((item) => !allowedScopes.has(item.scope));
    const visibleReminders = submitted.preTripReminders.filter((item) => allowedScopes.has(item.scope));
    const trip = { ...submitted, travelers: submitted.members.length, preTripReminders: [...visibleReminders, ...hiddenReminders] };
    const result = await saveOwnerTrip(user.userId, trip);
    return NextResponse.json({ ok: true, ...result });
  } catch {
    return NextResponse.json({ error: "暂时无法保存，请稍后重试" }, { status: 503 });
  }
}
