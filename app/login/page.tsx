"use client";

import { FormEvent, useState } from "react";
import { Loader2, LockKeyhole, MapPinned } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "register" | "reset">("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/auth/${mode === "reset" ? "reset-password" : mode}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: data.get("email"),
          password: data.get("password"),
          displayName: data.get("displayName"),
          code: data.get("code"),
        }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "操作失败，请稍后重试");
      window.location.href = "/";
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "操作失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f5f7] px-4 py-10 text-[#1d1d1f] sm:grid sm:place-items-center">
      <section className="mx-auto w-full max-w-md overflow-hidden rounded-[32px] border border-black/5 bg-white shadow-[0_28px_80px_rgba(0,0,0,.12)]">
        <div className="bg-[#0c2744] px-7 py-8 text-white">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-full bg-white/10"><MapPinned className="size-5" /></span>
            <div><p className="text-xs font-semibold tracking-[.18em] text-white/55">PRIVATE JOURNEY</p><h1 className="mt-1 text-2xl font-semibold">旅行档案登录</h1></div>
          </div>
          <p className="mt-5 text-sm leading-6 text-white/65">只有本次旅行的管理员和已邀请成员可以进入。行程、提醒和共同账本会在成员之间同步。</p>
        </div>
        <div className="p-7">
          <div className="mb-6 grid grid-cols-3 rounded-full bg-[#f0f0f2] p-1 text-sm font-semibold">
            <button type="button" onClick={() => { setMode("login"); setError(""); }} className={`rounded-full px-4 py-2.5 transition ${mode === "login" ? "bg-white shadow-sm" : "text-[#6e6e73]"}`}>登录</button>
            <button type="button" onClick={() => { setMode("register"); setError(""); }} className={`rounded-full px-4 py-2.5 transition ${mode === "register" ? "bg-white shadow-sm" : "text-[#6e6e73]"}`}>注册</button>
            <button type="button" onClick={() => { setMode("reset"); setError(""); }} className={`rounded-full px-4 py-2.5 transition ${mode === "reset" ? "bg-white shadow-sm" : "text-[#6e6e73]"}`}>重置</button>
          </div>
          <form className="space-y-4" onSubmit={submit}>
            {mode === "register" && <label className="block"><span className="mb-1.5 block text-xs font-bold text-[#6e6e73]">显示名称</span><Input name="displayName" autoComplete="name" maxLength={60} placeholder="例如：Henry" required /></label>}
            <label className="block"><span className="mb-1.5 block text-xs font-bold text-[#6e6e73]">邮箱</span><Input name="email" type="email" autoComplete="email" placeholder="name@example.com" required /></label>
            {mode === "reset" && <label className="block"><span className="mb-1.5 block text-xs font-bold text-[#6e6e73]">一次性重置码</span><Input name="code" autoComplete="one-time-code" minLength={10} maxLength={10} placeholder="由旅行管理员提供" required /></label>}
            <label className="block"><span className="mb-1.5 block text-xs font-bold text-[#6e6e73]">{mode === "reset" ? "新密码" : "密码"}</span><Input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={10} maxLength={128} placeholder="至少 10 位，包含字母和数字" required /></label>
            {mode === "register" && <p className="text-xs leading-5 text-[#86868b]">管理员可直接注册；同行成员需要先由管理员把邮箱加入旅行成员列表。</p>}
            {mode === "reset" && <p className="text-xs leading-5 text-[#86868b]">请先联系旅行创建者，由创建者后台生成 30 分钟内有效的一次性重置码。</p>}
            {error && <div className="rounded-2xl border border-[#ff3b30]/15 bg-[#ff3b30]/7 px-4 py-3 text-sm text-[#b42318]">{error}</div>}
            <Button className="h-12 w-full rounded-full bg-[#0071e3] text-white hover:bg-[#0062c4]" disabled={loading}>{loading ? <Loader2 className="animate-spin" /> : <LockKeyhole />}{mode === "login" ? "安全登录" : mode === "register" ? "创建账户" : "设置新密码"}</Button>
          </form>
        </div>
      </section>
    </main>
  );
}
