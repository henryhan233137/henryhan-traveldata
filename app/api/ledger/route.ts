import { NextResponse } from "next/server";
import { env } from "cloudflare:workers";
import { getAppUser } from "@/lib/auth";
import { loadSharedTrip, saveSharedTrip } from "@/db/trips";
import { normalizeTripSnapshot, type TripLedger } from "@/lib/trip-data";

export const dynamic = "force-dynamic";

function isOwner(email: string | undefined) {
  return Boolean(email && env.OWNER_EMAIL && email.toLowerCase() === env.OWNER_EMAIL.toLowerCase());
}

function ledgerAllowed(email: string | undefined, trip: ReturnType<typeof normalizeTripSnapshot>) {
  if (isOwner(email)) return true;
  return Boolean(email && trip.members.some((member) => member.ledgerAccess && member.email && member.email.toLowerCase() === email.toLowerCase()));
}

export async function POST(request: Request) {
  const user = await getAppUser();
  if (!user) return NextResponse.json({ error: "请先登录后记账" }, { status: 401 });
  const stored = await loadSharedTrip();
  if (!stored) return NextResponse.json({ error: "旅行档案暂时不可用" }, { status: 503 });
  const trip = normalizeTripSnapshot(stored.trip);
  if (!ledgerAllowed(user.email, trip)) return NextResponse.json({ error: "当前邮箱尚未被邀请参与记账" }, { status: 403 });
  const ledger = (await request.json()) as TripLedger;
  if (!ledger || ledger.baseCurrency !== "CNY" || !Array.isArray(ledger.bills)) {
    return NextResponse.json({ error: "账本数据不完整" }, { status: 400 });
  }
  if (ledger.bills.some((bill) => !bill.id || !Number.isSafeInteger(bill.baseAmountCents) || bill.baseAmountCents <= 0 || !bill.payerId || !Array.isArray(bill.participantIds) || !bill.participantIds.length)) {
    return NextResponse.json({ error: "存在无效账目" }, { status: 400 });
  }
  try {
    const result = await saveSharedTrip({ ...trip, ledger });
    return NextResponse.json({ ok: true, ledger, ...result });
  } catch {
    return NextResponse.json({ error: "账本同步失败，请稍后重试" }, { status: 503 });
  }
}
