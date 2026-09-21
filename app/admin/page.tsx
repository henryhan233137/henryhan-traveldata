"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Ban, CheckCircle2, Copy, KeyRound, Loader2, LogOut, ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

type AdminUser = {
  id: string;
  email: string;
  displayName: string;
  role: "owner" | "member";
  disabled: number;
  createdAt: string;
  lastLoginAt: string | null;
  activeSessions: number;
  sessionExpiresAt: string | null;
};

export default function AdminPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [resetCode, setResetCode] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/users");
    if (response.status === 401 || response.status === 403) {
      window.location.href = "/";
      return;
    }
    const data = await response.json() as { users?: AdminUser[] };
    setUsers(Array.isArray(data.users) ? data.users : []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function act(userId: string, action: "disable" | "enable" | "logout" | "reset") {
    setBusy(`${userId}:${action}`);
    setNotice("");
    setResetCode("");
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId, action }),
      });
      const data = await response.json() as { error?: string; resetCode?: string };
      if (!response.ok) throw new Error(data.error ?? "操作失败");
      if (data.resetCode) {
        setResetCode(data.resetCode);
        setNotice("一次性重置码已生成，30 分钟内有效。请通过可信方式单独发给该成员。");
      } else {
        setNotice(action === "logout" ? "该账号已从所有设备退出。" : "账号状态已更新。");
      }
      await load();
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "操作失败");
    } finally {
      setBusy("");
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f5f7] px-4 py-8 text-[#1d1d1f] sm:px-7">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-full bg-[#0c2744] text-white"><ShieldCheck className="size-5" /></span>
            <div><p className="text-xs font-bold tracking-[.16em] text-[#86868b]">CREATOR CONSOLE</p><h1 className="text-3xl font-semibold tracking-tight">创建者后台</h1></div>
          </div>
          <Button variant="outline" className="rounded-full" onClick={() => { window.location.href = "/"; }}><ArrowLeft /> 返回旅行页面</Button>
        </header>

        <section className="mb-5 grid gap-3 sm:grid-cols-3">
          <article className="rounded-3xl bg-white p-5 shadow-sm"><Users className="size-5 text-[#0071e3]" /><p className="mt-3 text-3xl font-semibold">{users.length}</p><p className="text-sm text-[#6e6e73]">已注册账号</p></article>
          <article className="rounded-3xl bg-white p-5 shadow-sm"><CheckCircle2 className="size-5 text-[#34c759]" /><p className="mt-3 text-3xl font-semibold">{users.filter((user) => !user.disabled).length}</p><p className="text-sm text-[#6e6e73]">可用账号</p></article>
          <article className="rounded-3xl bg-white p-5 shadow-sm"><LogOut className="size-5 text-[#ff9f0a]" /><p className="mt-3 text-3xl font-semibold">{users.reduce((total, user) => total + Number(user.activeSessions || 0), 0)}</p><p className="text-sm text-[#6e6e73]">活跃登录会话</p></article>
        </section>

        {notice && <div className="mb-5 rounded-2xl border border-black/5 bg-white p-4 text-sm shadow-sm"><p>{notice}</p>{resetCode && <div className="mt-3 flex items-center gap-2"><code className="rounded-xl bg-[#0c2744] px-4 py-2 text-lg font-bold tracking-[.18em] text-white">{resetCode}</code><Button size="icon" variant="outline" aria-label="复制重置码" onClick={() => void navigator.clipboard.writeText(resetCode)}><Copy /></Button></div>}</div>}

        <section className="overflow-hidden rounded-3xl bg-white shadow-sm">
          <div className="border-b border-black/5 px-5 py-4"><h2 className="font-semibold">成员账号</h2><p className="mt-1 text-sm text-[#86868b]">为了安全，密码永远不可查看；需要时生成一次性重置码。</p></div>
          {loading ? <div className="grid min-h-52 place-items-center"><Loader2 className="animate-spin text-[#0071e3]" /></div> : <div className="divide-y divide-black/5">{users.map((user) => <article key={user.id} className="grid gap-4 p-5 lg:grid-cols-[1.5fr_.8fr_1fr_auto] lg:items-center">
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="truncate">{user.displayName}</strong><span className={`rounded-full px-2 py-1 text-[11px] font-bold ${user.role === "owner" ? "bg-[#0071e3]/10 text-[#0071e3]" : "bg-black/5 text-[#6e6e73]"}`}>{user.role === "owner" ? "创建者" : "成员"}</span>{Boolean(user.disabled) && <span className="rounded-full bg-[#ff3b30]/10 px-2 py-1 text-[11px] font-bold text-[#b42318]">已禁用</span>}</div><p className="mt-1 truncate text-sm text-[#6e6e73]">{user.email}</p></div>
            <div className="text-sm"><p className="font-semibold">{Number(user.activeSessions || 0)} 个活跃会话</p><p className="mt-1 text-xs text-[#86868b]">注册 {formatDate(user.createdAt)}</p></div>
            <div className="text-sm"><p className="font-semibold">最近登录</p><p className="mt-1 text-xs text-[#86868b]">{user.lastLoginAt ? formatDate(user.lastLoginAt) : "尚未重新登录"}</p></div>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              <Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => void act(user.id, "reset")}><KeyRound /> 重置密码</Button>
              <Button size="sm" variant="outline" disabled={Boolean(busy) || user.role === "owner"} onClick={() => void act(user.id, user.disabled ? "enable" : "disable")}>{user.disabled ? <CheckCircle2 /> : <Ban />}{user.disabled ? "启用" : "禁用"}</Button>
              <Button size="sm" variant="ghost" disabled={Boolean(busy)} onClick={() => void act(user.id, "logout")}><LogOut /> 全部退出</Button>
            </div>
          </article>)}</div>}
        </section>
      </div>
    </main>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
