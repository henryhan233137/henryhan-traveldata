"use client";

import { Check, Plus, ReceiptText, Trash2, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { LedgerBill, LedgerCategory, TripLedger, TripMember } from "@/lib/trip-data";

const categories: LedgerCategory[] = ["美食", "交通", "住宿", "门票", "购物", "其他"];
const currencies = ["CNY", "KRW", "USD", "JPY"] as const;

function money(cents: number, currency = "CNY") {
  return new Intl.NumberFormat("zh-CN", { style: "currency", currency, maximumFractionDigits: 2 }).format(cents / 100);
}

function sharesFor(bill: LedgerBill) {
  const shares = new Map<string, number>();
  const count = bill.participantIds.length;
  if (!count) return shares;
  const base = Math.floor(bill.baseAmountCents / count);
  let remainder = bill.baseAmountCents - base * count;
  bill.participantIds.forEach((id) => {
    shares.set(id, base + (remainder > 0 ? 1 : 0));
    if (remainder > 0) remainder -= 1;
  });
  return shares;
}

function balances(members: TripMember[], bills: LedgerBill[]) {
  return members.map((member) => {
    const paid = bills.filter((bill) => bill.payerId === member.id).reduce((sum, bill) => sum + bill.baseAmountCents, 0);
    const owed = bills.reduce((sum, bill) => sum + (sharesFor(bill).get(member.id) || 0), 0);
    return { ...member, paid, owed, net: paid - owed };
  });
}

function settlements(input: ReturnType<typeof balances>) {
  const debtors = input.filter((item) => item.net < 0).map((item) => ({ id: item.id, amount: -item.net })).sort((a, b) => b.amount - a.amount || a.id.localeCompare(b.id));
  const creditors = input.filter((item) => item.net > 0).map((item) => ({ id: item.id, amount: item.net })).sort((a, b) => b.amount - a.amount || a.id.localeCompare(b.id));
  const memo = new Map<string, { fromId: string; toId: string; amount: number }[]>();

  function search(debts: number[], credits: number[]): { fromId: string; toId: string; amount: number }[] {
    const debtorIndex = debts.findIndex((amount) => amount > 0);
    if (debtorIndex < 0) return [];
    const key = `${debts.join(",")}|${credits.join(",")}`;
    const cached = memo.get(key);
    if (cached) return cached;
    const lowerBound = Math.max(debts.filter(Boolean).length, credits.filter(Boolean).length);
    let best: { fromId: string; toId: string; amount: number }[] | null = null;
    const tried = new Set<number>();
    for (let creditIndex = 0; creditIndex < credits.length; creditIndex += 1) {
      if (credits[creditIndex] <= 0 || tried.has(credits[creditIndex])) continue;
      tried.add(credits[creditIndex]);
      const amount = Math.min(debts[debtorIndex], credits[creditIndex]);
      const nextDebts = [...debts];
      const nextCredits = [...credits];
      nextDebts[debtorIndex] -= amount;
      nextCredits[creditIndex] -= amount;
      const candidate = [{ fromId: debtors[debtorIndex].id, toId: creditors[creditIndex].id, amount }, ...search(nextDebts, nextCredits)];
      if (!best || candidate.length < best.length) best = candidate;
      if (best.length <= lowerBound) break;
    }
    const result = best || [];
    memo.set(key, result);
    return result;
  }

  return search(debtors.map((item) => item.amount), creditors.map((item) => item.amount));
}

export function TripLedgerPanel({ members, ledger, canEdit, onChange, onLogin }: {
  members: TripMember[];
  ledger: TripLedger;
  canEdit: boolean;
  onChange: (next: TripLedger) => void;
  onLogin: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<(typeof currencies)[number]>("KRW");
  const [rate, setRate] = useState("0.0052");
  const [category, setCategory] = useState<LedgerCategory>("美食");
  const [note, setNote] = useState("");
  const [payerId, setPayerId] = useState(members[0]?.id || "");
  const [participants, setParticipants] = useState<string[]>(members.map((member) => member.id));
  const [notice, setNotice] = useState("");
  const stats = useMemo(() => balances(members, ledger.bills), [members, ledger.bills]);
  const transfers = useMemo(() => settlements(stats), [stats]);
  const total = ledger.bills.reduce((sum, bill) => sum + bill.baseAmountCents, 0);

  function toggleParticipant(id: string) {
    setParticipants((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function addBill() {
    if (!canEdit) return onLogin();
    const value = Number(amount.replaceAll(",", ""));
    const exchangeRate = currency === "CNY" ? 1 : Number(rate);
    if (!Number.isFinite(value) || value <= 0 || !Number.isFinite(exchangeRate) || exchangeRate <= 0 || !payerId || !participants.length) {
      setNotice("请填写有效金额、汇率、付款人，并至少选择一位参与者。");
      return;
    }
    const now = new Date().toISOString();
    const originalAmountCents = Math.round(value * 100);
    const baseAmountCents = currency === "CNY" ? originalAmountCents : Math.round(value * exchangeRate * 100);
    const bill: LedgerBill = {
      id: `bill-${crypto.randomUUID?.() || Date.now()}`,
      originalAmountCents,
      baseAmountCents,
      currency,
      exchangeRate,
      category,
      note: note.trim() || `${category}消费`,
      payerId,
      participantIds: [...participants],
      orderedAt: now.slice(0, 16),
      createdAt: now,
    };
    onChange({ ...ledger, bills: [bill, ...ledger.bills] });
    setAmount("");
    setNote("");
    setNotice("这笔账已加入共同账本并同步保存。");
  }

  function removeBill(id: string) {
    if (!canEdit) return onLogin();
    onChange({ ...ledger, bills: ledger.bills.filter((bill) => bill.id !== id) });
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[.88fr_1.12fr]">
      <section className="ledger-surface">
        <div className="flex items-start justify-between gap-4">
          <div><p className="section-kicker">NEW EXPENSE</p><h2 className="text-2xl font-black">记一笔</h2></div>
          <span className="rounded-full border border-[#6eb3e8]/25 bg-[#6eb3e8]/8 px-3 py-1.5 text-xs font-bold text-[#91c6ed]">基准币种 CNY</span>
        </div>
        <div className="mt-5 grid gap-4">
          <div className="grid grid-cols-[112px_1fr] gap-3">
            <label><span className="ledger-label">币种</span><select value={currency} onChange={(event) => setCurrency(event.target.value as typeof currency)} className="ledger-control">{currencies.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label><span className="ledger-label">原币金额</span><Input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder={currency === "KRW" ? "例如 48000" : "0.00"} className="text-right" /></label>
          </div>
          {currency !== "CNY" && <label><span className="ledger-label">1 {currency} = 多少 CNY（可自由修改）</span><Input inputMode="decimal" value={rate} onChange={(event) => setRate(event.target.value)} /></label>}
          <div><span className="ledger-label">分类</span><div className="grid grid-cols-3 gap-2 sm:grid-cols-6">{categories.map((item) => <button key={item} className={`ledger-choice ${category === item ? "ledger-choice-active" : ""}`} onClick={() => setCategory(item)}>{item}</button>)}</div></div>
          <label><span className="ledger-label">详细信息</span><Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="例如：广藏市场晚餐、烤肉和饮料" /></label>
          <div><span className="ledger-label">谁付款</span><div className="flex flex-wrap gap-2">{members.map((member) => <button key={member.id} className={`member-chip ${payerId === member.id ? "member-chip-active" : ""}`} onClick={() => setPayerId(member.id)}><span style={{ background: member.color }}>{member.name.slice(0, 1)}</span>{member.name}</button>)}</div></div>
          <div><div className="mb-2 flex items-center justify-between"><span className="ledger-label !mb-0">参与分账的人</span><button className="text-xs font-bold text-[#82bfea]" onClick={() => setParticipants(participants.length === members.length ? [] : members.map((member) => member.id))}>{participants.length === members.length ? "取消全选" : "全选"}</button></div><div className="grid grid-cols-4 gap-2">{members.map((member) => { const checked = participants.includes(member.id); return <button key={member.id} className={`participant-choice ${checked ? "participant-choice-active" : ""}`} onClick={() => toggleParticipant(member.id)}><span style={{ background: member.color }}>{member.name.slice(0, 1)}</span><small>{member.name}</small>{checked && <Check />}</button>; })}</div></div>
          {notice && <p className="rounded-xl bg-[#10233a] px-3 py-2 text-sm text-[#b9cadb]">{notice}</p>}
          <Button size="lg" onClick={addBill} className="w-full rounded-full bg-[#0071e3] text-white hover:bg-[#0062c4]"><Plus />{canEdit ? "加入共同账本" : "登录后记账"}</Button>
        </div>
      </section>

      <div className="grid gap-5">
        <section className="ledger-surface">
          <div className="flex items-end justify-between gap-4"><div><p className="section-kicker">SHARED LEDGER</p><h2 className="text-2xl font-black">共同账本</h2></div><div className="text-right"><p className="text-xs text-[#8799ad]">旅行总支出</p><p className="mt-1 text-2xl font-black text-[#f4d795]">{money(total)}</p></div></div>
          {ledger.bills.length ? <div className="mt-5 grid gap-3">{ledger.bills.map((bill) => {
            const payer = members.find((member) => member.id === bill.payerId);
            return <article key={bill.id} className="bill-row"><span className="grid size-10 place-items-center rounded-xl bg-[#142b45] text-[#77b6e5]"><ReceiptText className="size-5" /></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong>{bill.note}</strong><span className="rounded bg-white/6 px-2 py-1 text-[11px] text-[#9eb0c3]">{bill.category}</span></div><p className="mt-1 text-xs text-[#8294aa]">{payer?.name || "未知"} 付款 · {bill.participantIds.length} 人分摊 · 汇率 {bill.exchangeRate}</p></div><div className="text-right"><strong>{money(bill.originalAmountCents, bill.currency)}</strong><p className="mt-1 text-xs text-[#79b5df]">≈ {money(bill.baseAmountCents)}</p></div><button aria-label="删除账目" onClick={() => removeBill(bill.id)} className="text-[#718399] hover:text-[#ff7379]"><Trash2 className="size-4" /></button></article>;
          })}</div> : <div className="ledger-empty"><ReceiptText /><p>还没有账目。第一笔消费可以只选择实际参加的三个人。</p></div>}
        </section>

        <section className="ledger-surface">
          <div className="flex items-center gap-2"><Users className="size-5 text-[#79b7e5]" /><h2 className="text-xl font-black">成员结算</h2></div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">{stats.map((item) => <article key={item.id} className="balance-card"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-full font-black text-white" style={{ background: item.color }}>{item.name.slice(0, 1)}</span><div><strong>{item.name}</strong><p className="text-xs text-[#8394a7]">已付 {money(item.paid)} · 应摊 {money(item.owed)}</p></div></div><strong className={item.net > 0 ? "text-[#72cfa8]" : item.net < 0 ? "text-[#ff8a70]" : "text-[#91a3b9]"}>{item.net > 0 ? `应收 ${money(item.net)}` : item.net < 0 ? `应付 ${money(-item.net)}` : "已结清"}</strong></article>)}</div>
          <div className="mt-5 border-t border-white/8 pt-4"><p className="mb-3 text-sm font-bold">最简转账方案</p>{transfers.length ? <div className="grid gap-2">{transfers.map((transfer, index) => { const from = members.find((member) => member.id === transfer.fromId); const to = members.find((member) => member.id === transfer.toId); return <div key={`${transfer.fromId}-${transfer.toId}-${index}`} className="settlement-row"><span>{from?.name} → {to?.name}</span><strong>{money(transfer.amount)}</strong></div>; })}</div> : <p className="text-sm text-[#8294aa]">当前账目无需转账。</p>}</div>
        </section>
      </div>
    </div>
  );
}
