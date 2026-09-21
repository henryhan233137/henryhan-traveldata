"use client";

import {
  BellRing, CalendarDays, Check, ChevronRight, CloudSnow, Edit3, FileDown,
  Hotel, Landmark, Loader2, Map, MapPinned, Navigation, Plane, PlaneTakeoff,
  Plus, Save, ShoppingBag, Ticket, TrainFront, Trash2, Utensils, Users, Waves,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TripLedgerPanel } from "@/components/trip-ledger";
import { TripRouteMap } from "@/components/trip-route-map";
import { defaultTrip, normalizeTripSnapshot, type TripLedger, type TripReminder, type TripSnapshot, type TravelDay } from "@/lib/trip-data";

const routeOptions = [
  { id: "openjaw" as const, label: "推荐 · 首尔进 / 釜山出", detail: "NKG → ICN · KTX · PUS → NKG", tag: "少走回头路" },
  { id: "round" as const, label: "备选 · 首尔往返", detail: "NKG ⇄ ICN · 往返 KTX", tag: "航班选择更多" },
];

const kindIcon = {
  文化: Landmark, 风景: Waves, 美食: Utensils, 购物: ShoppingBag,
  交通: TrainFront, 经典场景: MapPinned,
} as const;

const memberColors = ["#F1464E", "#287B90", "#C58B32", "#8B6AA8", "#0071E3", "#2E8B57", "#C04C8A", "#6B7280"];

export default function Home() {
  const [trip, setTrip] = useState<TripSnapshot>(defaultTrip);
  const [canEdit, setCanEdit] = useState(false);
  const [canEditLedger, setCanEditLedger] = useState(false);
  const [canEditReminders, setCanEditReminders] = useState(false);
  const [canEditTickets, setCanEditTickets] = useState(false);
  const [viewerMemberId, setViewerMemberId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [newTripOpen, setNewTripOpen] = useState(false);
  const [infoDialog, setInfoDialog] = useState<"members" | "weather" | "reminders" | null>(null);
  const [weatherCity, setWeatherCity] = useState<"seoul" | "busan">("seoul");
  const [weather, setWeather] = useState<{ city: string; days: { date: string; code: number; max: number; min: number; rain: number; wind: number }[] } | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  useEffect(() => {
    fetch("/api/trip")
      .then((response) => response.json())
      .then((data) => {
        if (data.trip) setTrip(normalizeTripSnapshot(data.trip));
        setCanEdit(Boolean(data.canEdit));
        setCanEditLedger(Boolean(data.canEditLedger));
        setCanEditReminders(Boolean(data.canEditReminders));
        setCanEditTickets(Boolean(data.canEditTickets));
        setViewerMemberId(data.viewerMemberId || null);
        if (data.storageUnavailable) setNotice("当前使用本地预览数据，发布后即可云端保存。");
      })
      .catch(() => setNotice("暂时使用内置行程，稍后可重新同步。"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (infoDialog !== "weather") return;
    setWeatherLoading(true);
    const controller = new AbortController();
    const coordinates = weatherCity === "busan" ? { latitude: 35.1796, longitude: 129.0756, name: "釜山" } : { latitude: 37.5665, longitude: 126.978, name: "首尔" };
    async function loadWeather() {
      try {
        const response = await fetch(`/api/weather?city=${weatherCity}`, { signal: controller.signal });
        if (response.ok) return await response.json();
        const query = new URLSearchParams({ latitude: String(coordinates.latitude), longitude: String(coordinates.longitude), daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max", timezone: "Asia/Seoul", forecast_days: "7" });
        const fallback = await fetch(`https://api.open-meteo.com/v1/forecast?${query}`, { signal: controller.signal });
        if (!fallback.ok) throw new Error("weather unavailable");
        const data = await fallback.json();
        return { city: coordinates.name, days: (data.daily?.time || []).map((date: string, index: number) => ({ date, code: data.daily.weather_code[index], max: data.daily.temperature_2m_max[index], min: data.daily.temperature_2m_min[index], rain: data.daily.precipitation_probability_max[index], wind: data.daily.wind_speed_10m_max[index] })) };
      } catch {
        return null;
      }
    }
    void loadWeather().then((data) => { if (!controller.signal.aborted) setWeather(data); }).finally(() => { if (!controller.signal.aborted) setWeatherLoading(false); });
    return () => controller.abort();
  }, [infoDialog, weatherCity]);

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: "update_trip_plan",
      title: "更新旅行计划",
      description: "更新当前首尔釜山旅行的暂定月份、同行人数或推荐交通路线，并同步刷新页面。",
      inputSchema: {
        type: "object",
        properties: {
          monthRange: { type: "string", description: "例如 2026年12月—2027年1月" },
          travelers: { type: "integer", minimum: 1, maximum: 99 },
          selectedRoute: { type: "string", enum: ["openjaw", "round"] },
        },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        const value = input as { monthRange?: string; travelers?: number; selectedRoute?: "openjaw" | "round" };
        setTrip((current) => {
          const requested = Number.isInteger(value.travelers) && Number(value.travelers) > 0 ? Number(value.travelers) : current.members.length;
          const members = requested > current.members.length
            ? [...current.members, ...Array.from({ length: requested - current.members.length }, (_, index) => { const number = current.members.length + index + 1; return { id: `member-${Date.now()}-${number}`, name: `同行人 ${number}`, email: "", color: memberColors[(number - 1) % memberColors.length], ledgerAccess: true }; })]
            : current.members.slice(0, requested);
          return { ...current, monthRange: value.monthRange?.trim() || current.monthRange, travelers: members.length, members, selectedRoute: value.selectedRoute ?? current.selectedRoute };
        });
        return { updated: true, fields: Object.keys(value) };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, []);

  function patchTrip(patch: Partial<TripSnapshot>) {
    setTrip((current) => ({ ...current, ...patch }));
  }

  function patchDay(index: number, patch: Partial<TravelDay>) {
    setTrip((current) => ({
      ...current,
      days: current.days.map((day, dayIndex) => dayIndex === index ? { ...day, ...patch } : day),
    }));
  }

  function googleMapsUrl(title: string, location?: { lat: number; lng: number }) {
    const query = location ? `${location.lat},${location.lng} ${title}` : title;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }

  async function saveTrip() {
    if (!canEdit) {
      window.location.href = "/signin-with-chatgpt?return_to=%2F";
      return;
    }
    setSaving(true);
    setNotice("");
    try {
      const response = await fetch("/api/trip", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(trip),
      });
      const data = await response.json();
      setNotice(response.ok ? "行程已同步保存。" : data.error ?? "保存失败，请稍后重试。");
    } catch {
      setNotice("网络暂时不可用，编辑内容仍保留在当前页面。请稍后保存。");
    } finally {
      setSaving(false);
    }
  }

  async function saveLedger(nextLedger: TripLedger) {
    setTrip((current) => ({ ...current, ledger: nextLedger }));
    if (!canEditLedger) {
      window.location.href = "/signin-with-chatgpt?return_to=%2F";
      return;
    }
    try {
      const response = await fetch("/api/ledger", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(nextLedger) });
      const data = await response.json();
      setNotice(response.ok ? "共同账本已同步。" : data.error ?? "账本同步失败。");
    } catch {
      setNotice("网络暂时不可用，账目保留在当前页面，稍后请再次保存。");
    }
  }

  async function saveReminders() {
    if (!canEditReminders) {
      window.location.href = "/signin-with-chatgpt?return_to=%2F";
      return;
    }
    try {
      const response = await fetch("/api/reminders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(trip.preTripReminders) });
      const data = await response.json();
      if (response.ok && Array.isArray(data.reminders)) setTrip((current) => ({ ...current, preTripReminders: data.reminders }));
      setNotice(response.ok ? "提醒事项已同步。" : data.error ?? "提醒事项保存失败。");
    } catch {
      setNotice("网络暂时不可用，提醒事项稍后请再次保存。");
    }
  }

  async function toggleTicket(dayIndex: number, stopIndex: number) {
    if (!canEditTickets) {
      window.location.href = "/signin-with-chatgpt?return_to=%2F";
      return;
    }
    const done = !trip.days[dayIndex]?.stops[stopIndex]?.ticketDone;
    const nextTrip = {
      ...trip,
      days: trip.days.map((day, currentDay) => currentDay === dayIndex ? { ...day, stops: day.stops.map((stop, currentStop) => currentStop === stopIndex ? { ...stop, ticketDone: done } : stop) } : day),
    };
    setTrip(nextTrip);
    try {
      const response = await fetch("/api/tickets", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ dayIndex, stopIndex, done }) });
      const data = await response.json();
      setNotice(response.ok ? "购票状态已同步。" : data.error ?? "购票状态保存失败。");
    } catch {
      setNotice("网络暂时不可用，购票状态稍后请再次保存。");
    }
  }

  function downloadGuide() {
    const sections = trip.days.map((day) => `${day.no} ${day.city}｜${day.title}\n${day.stops.map((stop) => `  ${stop.time} ${stop.title}｜${stop.note}`).join("\n")}`).join("\n\n");
    const text = `${trip.title}\n${trip.monthRange}｜${trip.members.length}人\n\n${sections}\n\n注意事项\n${trip.notes}`;
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "首尔釜山旅行手册.txt";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="apple-shell min-h-screen bg-[#f5f5f7] text-[#1d1d1f]">
      <header className="sticky top-0 z-30 border-b border-black/5 bg-white/75 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between px-4 sm:px-7">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-full bg-[#1d1d1f] text-white"><MapPinned className="size-[18px]" /></span>
            <div><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#86868b]">Private journey</p><p className="font-semibold tracking-tight">旅行计划</p></div>
          </div>
          <div className="flex items-center gap-2">
            <Dialog open={newTripOpen} onOpenChange={setNewTripOpen}>
              <DialogTrigger asChild><Button variant="ghost" className="hidden sm:inline-flex"><Plus /> 新旅行</Button></DialogTrigger>
              <DialogContent className="sm:max-w-xl">
                <DialogHeader><DialogTitle>创建新的旅行档案</DialogTitle><DialogDescription>只要输入目的地、月份和天数，即可生成可编辑的路线骨架。</DialogDescription></DialogHeader>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="出发地"><Input defaultValue="中国南京" /></Field>
                  <Field label="目的地"><Input placeholder="例如：日本关西" /></Field>
                  <Field label="大概月份"><Input placeholder="例如：2027年4月" /></Field>
                  <Field label="旅行天数"><Input type="number" defaultValue="5" min="1" max="30" /></Field>
                </div>
                <Field label="旅行偏好"><Textarea placeholder="文化、风景、美食、购物……" /></Field>
                <div className="rounded-xl border border-[#6eb3e8]/20 bg-[#6eb3e8]/7 p-3 text-sm leading-6 text-[#afc7dd]">当前版本先创建可编辑模板；接入可选 AI 服务后，可在网站内直接研究目的地并生成完整初稿。</div>
                <DialogFooter><DialogClose asChild><Button variant="outline">取消</Button></DialogClose><Button onClick={() => { setNewTripOpen(false); setNotice("新旅行生成器已记录为下一步功能；当前先完成韩国案例。"); }}>生成草案</Button></DialogFooter>
              </DialogContent>
            </Dialog>
            <Button onClick={saveTrip} className="rounded-full bg-[#0071e3] px-5 text-white hover:bg-[#0062c4]">{saving ? <Loader2 className="animate-spin" /> : <Save />}{canEdit ? "保存" : "登录编辑"}</Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-4 pb-20 pt-5 sm:px-7 sm:pt-7">
        {notice && <div className="mb-4 flex items-center justify-between rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm text-[#515154] shadow-sm"><span>{notice}</span><button onClick={() => setNotice("")} className="text-[#86868b]">关闭</button></div>}
        <section className="case-hero relative overflow-hidden rounded-[34px]">
          <div className="hero-glow" />
          <div className="relative grid min-h-[430px] items-center gap-8 p-7 sm:p-12 lg:grid-cols-[.9fr_1.1fr] lg:p-16">
            <div>
              <div className="flex flex-wrap items-center gap-2"><span className="evidence-label">KOREA · 5 DAYS</span><span className="status-pill">日期待定</span><span className="status-pill">南京出发</span></div>
              <p className="mb-4 mt-10 flex items-center gap-2 text-sm font-semibold text-[#6e6e73]"><MapPinned className="size-4 text-[#0071e3]" /> 南京 → 首尔 → 釜山</p>
              <h1 className="journey-title"><span>{trip.title}</span><small>SEOUL · BUSAN</small></h1>
              <div className="mt-8 flex flex-wrap gap-3">
                <Dialog>
                  <DialogTrigger asChild><Button size="lg" className="rounded-full bg-[#0071e3] px-6 text-white hover:bg-[#0062c4]"><Edit3 /> 编辑旅行信息</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>编辑旅行信息</DialogTitle><DialogDescription>具体日期可以继续留空，先按月份规划。</DialogDescription></DialogHeader>
                    <Field label="旅行名称"><Input value={trip.title} onChange={(event) => patchTrip({ title: event.target.value })} /></Field>
                    <Field label="暂定月份"><Input value={trip.monthRange} onChange={(event) => patchTrip({ monthRange: event.target.value })} /></Field>
                    <div className="grid grid-cols-2 gap-3"><Field label="确定出发日"><Input type="date" value={trip.exactStart} onChange={(event) => patchTrip({ exactStart: event.target.value })} /></Field><Field label="确定返程日"><Input type="date" value={trip.exactEnd} onChange={(event) => patchTrip({ exactEnd: event.target.value })} /></Field></div>
                    <DialogFooter><DialogClose asChild><Button>完成</Button></DialogClose></DialogFooter>
                  </DialogContent>
                </Dialog>
                <Button size="lg" variant="outline" onClick={downloadGuide} className="rounded-full border-black/10 bg-white/70 px-6"><FileDown /> 下载离线手册</Button>
              </div>
            </div>
            <div className="pixel-stage"><img src="/images/korea-pixel-panorama.png" alt="首尔宫殿、南山塔、KTX、釜山海岸和韩国美食的原创像素画" /></div>
          </div>
        </section>

        <section className="flight-board mt-5" aria-label="往返航班信息">
          <div className="flight-board-heading"><span><PlaneTakeoff /></span><div><p>FLIGHT ITINERARY</p><h2>往返航班</h2></div></div>
          <div className="flight-board-grid">{trip.transports.filter((item) => item.type === "飞机").map((item) => <article key={item.id} className="flight-summary-card"><div className="flight-summary-meta"><span>{item.id === "outbound" ? "去程" : "返程"}</span><time>{item.date}</time></div><div className="flight-airports"><strong>{item.from}</strong><span><Plane /></span><strong>{item.to}</strong></div><div className="flight-summary-detail"><b>{item.service}</b><span>{item.detail}</span></div></article>)}</div>
        </section>

        <section className="mt-5 grid gap-3 md:grid-cols-3">
          <Intel icon={Users} label="同行成员" value={`${trip.members.length} 位成人`} meta="点击查看成员与记账权限" onClick={() => setInfoDialog("members")} />
          <Intel icon={CloudSnow} label="季节提示" value="寒冷 · 可能降雪" meta="点击查看首尔 / 釜山未来 7 天" onClick={() => setInfoDialog("weather")} />
          <Intel icon={BellRing} label="出发前提醒" value={`${trip.preTripReminders.filter((item) => item.done).length} / ${trip.preTripReminders.length} 已完成`} meta="点击勾选或编辑准备事项" onClick={() => setInfoDialog("reminders")} />
        </section>

        <Tabs defaultValue="overview" className="mt-8">
          <TabsList variant="line" className="trip-tabs-list border-b border-black/8 pb-3">
            {[["overview", "总览"], ["itinerary", "每日行程"], ["transport", "交通"], ["map", "路线图"], ["ledger", "共同账本"]].map(([value, label]) => <TabsTrigger key={value} value={value} className="trip-tab text-[#86868b] data-[state=active]:text-[#1d1d1f]">{label}</TabsTrigger>)}
          </TabsList>

          <TabsContent value="overview" className="mt-6 grid gap-5 xl:grid-cols-[1.3fr_.7fr]">
            <section className="dossier-panel">
              <PanelHeading kicker="ACTION LOG" title="五日行动记录" action="查看每日详情" />
              <div className="space-y-2">{trip.days.map((day, index) => <DayRow key={day.no} day={day} index={index} onEdit={() => setEditingDay(index)} />)}</div>
            </section>
            <aside className="dossier-panel">
              <PanelHeading kicker="ROUTE DECISION" title="交通路线待确认" />
              <p className="mb-4 text-sm leading-6 text-[#91a3b9]">勾选后，地图、住宿城市和最后一天安排同步调整。</p>
              <div className="space-y-3">{routeOptions.map((route) => {
                const checked = trip.selectedRoute === route.id;
                return <label key={route.id} className={`route-choice ${checked ? "route-choice-active" : ""}`}><Checkbox checked={checked} onCheckedChange={() => patchTrip({ selectedRoute: route.id })} className="mt-1 border-black/20 data-[state=checked]:border-[#0071e3] data-[state=checked]:bg-[#0071e3]" /><span className="min-w-0 flex-1"><span className="block font-semibold text-[#1d1d1f]">{route.label}</span><span className="mt-1 block text-sm text-[#6e6e73]">{route.detail}</span><span className="mt-3 inline-block rounded-full bg-[#e8f2ff] px-2.5 py-1 text-xs font-semibold text-[#0066cc]">{route.tag}</span></span></label>;
              })}</div>
              <div className="mt-5 rounded-2xl border border-dashed border-white/16 bg-black/12 p-4"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-lg bg-[#f1464e]/12 text-[#f1464e]"><TrainFront className="size-5" /></span><div><p className="font-bold">首尔站 → 釜山站</p><p className="text-sm text-[#91a3b9]">KTX · 约 2小时30分 · 班次待选</p></div></div></div>
            </aside>
            <section className="dossier-panel min-w-0 xl:col-span-2"><PanelHeading kicker="TRIP MAP" title="本次旅行路线" action="按天筛选 · 可放大缩小" /><TripRouteMap days={trip.days} /></section>
          </TabsContent>

          <TabsContent value="itinerary" className="mt-6">
            <section className="grid gap-4 lg:grid-cols-2">{trip.days.map((day, index) => <article key={day.no} className="dossier-panel">
              <div className="mb-5 flex items-start justify-between"><div><p className="section-kicker">DAY {day.no} · {day.city}</p><h2 className="text-xl font-semibold tracking-tight">{day.title}</h2><p className="mt-1 text-sm text-[#6e6e73]">{day.summary}</p></div><Button size="icon-sm" variant="ghost" onClick={() => setEditingDay(index)} aria-label={`编辑第${index + 1}天`}><Edit3 /></Button></div>
              <div className="timeline-list">{day.stops.map((stop, stopIndex) => { const Icon = kindIcon[stop.kind]; return <div key={`${stop.time}-${stop.title}`} className="timeline-item"><span className="timeline-dot"><Icon className="size-4" /></span><div className="min-w-0"><p className="text-xs font-semibold text-[#0071e3]">{stop.time} · {stop.kind}</p><h3 className="mt-1 font-semibold">{stop.title}</h3><p className="mt-1 text-sm leading-6 text-[#6e6e73]">{stop.note}</p><div className="mt-3 flex flex-wrap gap-2"><a href={googleMapsUrl(stop.title, stop.location)} target="_blank" rel="noreferrer" className="place-action"><Navigation /> Google 地图导航</a>{stop.ticketRequired && <button type="button" onClick={() => void toggleTicket(index, stopIndex)} className={`ticket-alert ${stop.ticketDone ? "ticket-alert-done" : ""}`}>{stop.ticketDone ? <Check /> : <Ticket />} {stop.ticketDone ? "已预约 / 已购票" : stop.ticketNote || "建议提前购票"}</button>}</div></div></div>; })}</div>
            </article>)}</section>
          </TabsContent>

          <TabsContent value="transport" className="mt-6">
            <section className="dossier-panel"><PanelHeading kicker="TRANSPORT FILES" title="交通档案" action="可直接修改" /><div className="grid gap-4 lg:grid-cols-3">{trip.transports.map((item, index) => <article key={item.id} className="transport-card"><div className="flex items-center justify-between"><span className="rounded-md bg-[#f1464e]/12 px-2 py-1 text-xs font-bold text-[#ff7279]">{item.type}</span><span className="text-xs text-[#91a3b9]">{item.status}</span></div><div className="mt-4 flex items-center gap-3"><span className="font-black">{item.from}</span><ChevronRight className="size-4 text-[#f1464e]" /><span className="font-black">{item.to}</span></div><div className="mt-4 space-y-3"><Field label="日期 / 行程日"><Input value={item.date} onChange={(event) => setTrip((current) => ({ ...current, transports: current.transports.map((transport, transportIndex) => transportIndex === index ? { ...transport, date: event.target.value } : transport) }))} /></Field><Field label="航班 / 车次"><Input value={item.service} onChange={(event) => setTrip((current) => ({ ...current, transports: current.transports.map((transport, transportIndex) => transportIndex === index ? { ...transport, service: event.target.value, status: "已录入" } : transport) }))} /></Field><Field label="详细信息"><Textarea value={item.detail} onChange={(event) => setTrip((current) => ({ ...current, transports: current.transports.map((transport, transportIndex) => transportIndex === index ? { ...transport, detail: event.target.value } : transport) }))} /></Field></div></article>)}</div></section>
          </TabsContent>

          <TabsContent value="map" className="mt-6 grid gap-5 xl:grid-cols-[1fr_.52fr]">
            <section className="dossier-panel min-w-0"><PanelHeading kicker="THE WHOLE JOURNEY" title="本次旅程" action="按天筛选 · 可放大缩小" /><TripRouteMap days={trip.days} /></section>
            <aside className="dossier-panel"><PanelHeading kicker="LIVE RULES" title="哪些内容会自动变化" /><div className="space-y-3">{[
              [Map, "景点顺序改变", "重排当天路线和预计移动时间"],
              [CloudSnow, "日期确定", "切换季节提示为实时天气预报"],
              [Hotel, "酒店改变", "更新每天起点、返程时间与交通建议"],
              [Plane, "航班录入", "联动首日与末日可用游玩时段"],
            ].map(([Icon, title, detail]) => <div key={String(title)} className="sync-rule"><span><Icon className="size-5" /></span><div><p className="font-bold">{String(title)}</p><p className="mt-1 text-sm text-[#91a3b9]">{String(detail)}</p></div></div>)}</div></aside>
          </TabsContent>

          <TabsContent value="ledger" className="mt-6">
            <TripLedgerPanel members={trip.members} ledger={trip.ledger} canEdit={canEditLedger} onChange={saveLedger} onLogin={() => { window.location.href = "/signin-with-chatgpt?return_to=%2F"; }} />
          </TabsContent>

        </Tabs>

        <section className="travel-notes mt-12">
          <div className="max-w-2xl"><p className="section-kicker">TRAVEL NOTES</p><h2 className="text-3xl font-semibold tracking-[-0.035em]">注意事项</h2><p className="mt-2 text-base leading-7 text-[#6e6e73]">签证、天气、行李或同行约定都可以写在这里，保存后与本次旅行同步。</p></div>
          <Textarea value={trip.notes} onChange={(event) => patchTrip({ notes: event.target.value })} rows={7} disabled={!canEdit} className="mt-6 resize-y rounded-2xl border-black/8 bg-white p-5 text-base leading-8 shadow-sm" />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-[#86868b]">每行一条更方便旅行途中快速查看。</p><Button onClick={saveTrip} className="rounded-full bg-[#1d1d1f] px-6 text-white hover:bg-black">{canEdit ? "保存注意事项" : "登录后编辑"}</Button></div>
        </section>
      </div>

      <Dialog open={infoDialog !== null} onOpenChange={(open) => !open && setInfoDialog(null)}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
          {infoDialog === "members" && <>
            <DialogHeader><DialogTitle>同行成员 · {trip.members.length} 人</DialogTitle><DialogDescription>人数没有固定上限。添加成员并填写其登录邮箱后，对方可以查看自己的个人提醒并参与共同记账。</DialogDescription></DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">{trip.members.map((member, memberIndex) => <article key={member.id} className="member-editor-card">
              <div className="mb-3 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-full font-black text-white" style={{ background: member.color }}>{member.name.slice(0, 1)}</span><div className="min-w-0 flex-1"><p className="truncate font-semibold">成员 {memberIndex + 1}</p><p className="truncate text-xs text-[#86868b]">{member.email || "尚未填写登录邮箱"}</p></div>{canEdit && memberIndex > 0 && <Button size="icon-sm" variant="ghost" aria-label={`删除${member.name}`} onClick={() => setTrip((current) => { const members = current.members.filter((_, index) => index !== memberIndex); return { ...current, members, travelers: members.length }; })}><Trash2 /></Button>}</div>
              <div className="grid gap-3"><Field label="显示名称"><Input value={member.name} disabled={!canEdit} onChange={(event) => setTrip((current) => ({ ...current, members: current.members.map((item, index) => index === memberIndex ? { ...item, name: event.target.value } : item) }))} /></Field><Field label="登录邮箱"><Input type="email" value={member.email} disabled={!canEdit} placeholder="填写成员登录所用邮箱" onChange={(event) => setTrip((current) => ({ ...current, members: current.members.map((item, index) => index === memberIndex ? { ...item, email: event.target.value.trim() } : item) }))} /></Field></div>
            </article>)}</div>
            {canEdit && <Button variant="outline" onClick={() => setTrip((current) => { const number = current.members.length + 1; const members = [...current.members, { id: `member-${Date.now()}`, name: `同行人 ${number}`, email: "", color: memberColors[(number - 1) % memberColors.length], ledgerAccess: true }]; return { ...current, members, travelers: members.length }; })}><Plus /> 添加同行成员</Button>}
            <div className="rounded-xl border border-[#0071e3]/15 bg-[#0071e3]/5 p-3 text-sm leading-6 text-[#515154]">当前发布平台使用安全的 ChatGPT 邮箱身份验证，不会在本站保存密码。迁移到中国大陆可稳定访问的独立域名后，可再切换为“邮箱注册 + 自设密码”。</div>
            <DialogFooter><Button variant="outline" onClick={() => setInfoDialog(null)}>关闭</Button>{canEdit && <Button onClick={() => { void saveTrip(); setInfoDialog(null); }}><Save /> 保存成员设置</Button>}</DialogFooter>
          </>}
          {infoDialog === "reminders" && <>
            <DialogHeader><DialogTitle>出发前提醒事项</DialogTitle><DialogDescription>所有成员都能看到通用提醒；个人提醒只有对应成员本人可见。登录后可以自由增加、删除和勾选。</DialogDescription></DialogHeader>
            <ReminderGroup title="通用提醒" hint="所有同行成员可见" scope="common" reminders={trip.preTripReminders} canEdit={canEdit} onChange={(reminders) => patchTrip({ preTripReminders: reminders })} />
            {viewerMemberId && <ReminderGroup title="我的个人提醒" hint="仅自己可见" scope={viewerMemberId} reminders={trip.preTripReminders} canEdit={canEditReminders} onChange={(reminders) => patchTrip({ preTripReminders: reminders })} />}
            {!canEditReminders && <div className="rounded-2xl bg-[#f5f5f7] p-4 text-sm leading-6 text-[#515154]">请先使用参与旅行的邮箱登录，随后即可添加和管理自己的个人提醒。</div>}
            <DialogFooter><Button variant="outline" onClick={() => setInfoDialog(null)}>关闭</Button><Button onClick={() => { if (canEditReminders) { void saveReminders(); setInfoDialog(null); } else { window.location.href = "/signin-with-chatgpt?return_to=%2F"; } }}><Save /> {canEditReminders ? "保存提醒" : "登录后编辑"}</Button></DialogFooter>
          </>}
          {infoDialog === "weather" && <>
            <DialogHeader><DialogTitle>首尔 / 釜山未来 7 天天气</DialogTitle><DialogDescription>通过本站服务器获取预报，避免浏览器直接依赖境外天气脚本；远期十二月至一月只能显示季节参考。</DialogDescription></DialogHeader>
            <div className="flex gap-2"><Button variant={weatherCity === "seoul" ? "default" : "outline"} onClick={() => setWeatherCity("seoul")}>首尔</Button><Button variant={weatherCity === "busan" ? "default" : "outline"} onClick={() => setWeatherCity("busan")}>釜山</Button></div>
            {weatherLoading ? <div className="grid min-h-48 place-items-center text-[#86868b]"><Loader2 className="size-6 animate-spin" /></div> : weather?.days?.length ? <div className="weather-grid">{weather.days.map((day) => <article key={day.date} className="weather-day"><p className="text-xs font-semibold text-[#86868b]">{new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", weekday: "short" }).format(new Date(`${day.date}T12:00:00`))}</p><strong className="mt-3 block text-lg">{weatherLabel(day.code)}</strong><p className="mt-3 text-2xl font-semibold">{Math.round(day.min)}°—{Math.round(day.max)}°</p><p className="mt-2 text-xs leading-5 text-[#6e6e73]">降水 {Math.round(day.rain)}% · 风速 {Math.round(day.wind)} km/h</p></article>)}</div> : <div className="rounded-2xl border border-[#ff9f0a]/20 bg-[#ff9f0a]/7 p-5 text-sm leading-7 text-[#6b4d15]">实时天气暂时不可用。首尔冬季通常比釜山更冷，建议按零下体感准备防风外套、保暖层和防滑鞋；出发前 7 天再以这里的实时预报为准。</div>}
            <DialogFooter><DialogClose asChild><Button>知道了</Button></DialogClose></DialogFooter>
          </>}
        </DialogContent>
      </Dialog>

      <Dialog open={editingDay !== null} onOpenChange={(open) => !open && setEditingDay(null)}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
          {editingDay !== null && <><DialogHeader><DialogTitle>编辑第 {editingDay + 1} 天</DialogTitle><DialogDescription>修改后，总览、地图地点与线路交通标注会立即更新。</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><Field label="城市"><Input value={trip.days[editingDay].city} onChange={(event) => patchDay(editingDay, { city: event.target.value })} /></Field><Field label="当天标题"><Input value={trip.days[editingDay].title} onChange={(event) => patchDay(editingDay, { title: event.target.value })} /></Field></div><Field label="路线摘要"><Input value={trip.days[editingDay].summary} onChange={(event) => patchDay(editingDay, { summary: event.target.value })} /></Field><div className="space-y-3">{trip.days[editingDay].stops.map((stop, stopIndex) => <div key={stopIndex} className="rounded-xl border border-black/8 bg-[#f5f5f7] p-3"><div className="grid gap-3 sm:grid-cols-[110px_1fr]"><Input value={stop.time} onChange={(event) => patchDay(editingDay, { stops: trip.days[editingDay].stops.map((current, currentIndex) => currentIndex === stopIndex ? { ...current, time: event.target.value } : current) })} /><Input value={stop.title} onChange={(event) => patchDay(editingDay, { stops: trip.days[editingDay].stops.map((current, currentIndex) => currentIndex === stopIndex ? { ...current, title: event.target.value } : current) })} /></div><Field label="前往这一站的交通"><Input className="mt-3" value={stop.transportFromPrevious || ""} placeholder="例如：地铁 · 约 20 分钟" onChange={(event) => patchDay(editingDay, { stops: trip.days[editingDay].stops.map((current, currentIndex) => currentIndex === stopIndex ? { ...current, transportFromPrevious: event.target.value } : current) })} /></Field><label className="mt-3 flex items-center gap-2 text-sm font-medium"><Checkbox checked={Boolean(stop.ticketRequired)} onCheckedChange={(checked) => patchDay(editingDay, { stops: trip.days[editingDay].stops.map((current, currentIndex) => currentIndex === stopIndex ? { ...current, ticketRequired: Boolean(checked) } : current) })} /> 需要提前购票或预约</label>{stop.ticketRequired && <Field label="购票提醒"><Input value={stop.ticketNote || ""} placeholder="例如：建议提前选择入场时段" onChange={(event) => patchDay(editingDay, { stops: trip.days[editingDay].stops.map((current, currentIndex) => currentIndex === stopIndex ? { ...current, ticketNote: event.target.value } : current) })} /></Field>}<Textarea className="mt-3" value={stop.note} onChange={(event) => patchDay(editingDay, { stops: trip.days[editingDay].stops.map((current, currentIndex) => currentIndex === stopIndex ? { ...current, note: event.target.value } : current) })} /></div>)}</div><DialogFooter><DialogClose asChild><Button><Check /> 完成编辑</Button></DialogClose></DialogFooter></>}
        </DialogContent>
      </Dialog>
      {loading && <div className="fixed inset-x-0 bottom-4 mx-auto flex w-fit items-center gap-2 rounded-full bg-[#1d1d1f] px-4 py-2 text-sm text-white shadow-xl"><Loader2 className="size-4 animate-spin" /> 正在载入旅行档案</div>}
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-xs font-bold tracking-wide text-[#91a3b9]">{label}</span>{children}</label>; }

function Intel({ icon: Icon, label, value, meta, onClick }: { icon: typeof CalendarDays; label: string; value: string; meta: string; onClick?: () => void }) {
  const content = <div className="flex items-start justify-between"><div><p className="text-xs font-semibold tracking-[0.12em] text-[#86868b]">{label}</p><p className="mt-2 text-lg font-semibold tracking-tight text-[#1d1d1f]">{value}</p><p className="mt-1 text-sm text-[#6e6e73]">{meta}</p></div><span className="grid size-10 place-items-center rounded-full bg-[#e8f2ff] text-[#0071e3]"><Icon className="size-5" /></span></div>;
  return onClick ? <button type="button" onClick={onClick} className="intel-card intel-card-button w-full text-left">{content}</button> : <article className="intel-card">{content}</article>;
}

function PanelHeading({ kicker, title, action }: { kicker: string; title: string; action?: string }) { return <div className="mb-5 flex items-center justify-between gap-4"><div><p className="section-kicker">{kicker}</p><h2 className="text-2xl font-semibold tracking-tight">{title}</h2></div>{action && <span className="hidden text-sm text-[#86868b] sm:block">{action}</span>}</div>; }

function DayRow({ day, index, onEdit }: { day: TravelDay; index: number; onEdit: () => void }) { return <button onClick={onEdit} className="day-row group w-full text-left"><div className="day-number">{day.no}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-3 gap-y-1"><h3 className="font-semibold text-[#1d1d1f]">{day.title}</h3><span className="text-xs font-semibold text-[#0071e3]">{day.city}</span></div><p className="mt-1 truncate text-sm text-[#6e6e73]">{day.summary}</p></div><span className="hidden text-xs text-[#86868b] sm:block">{index === 2 ? "跨城" : "当日路线"}</span><ChevronRight className="size-4 text-[#86868b] transition group-hover:translate-x-1 group-hover:text-[#1d1d1f]" /></button>; }

function ReminderGroup({ title, hint, scope, reminders, canEdit, onChange }: { title: string; hint: string; scope: string; reminders: TripReminder[]; canEdit: boolean; onChange: (next: TripReminder[]) => void }) {
  const scoped = reminders.filter((item) => item.scope === scope);
  function patch(id: string, update: Partial<TripReminder>) { onChange(reminders.map((item) => item.id === id ? { ...item, ...update } : item)); }
  return <section className="reminder-group"><div className="mb-3 flex items-end justify-between gap-3"><div><h3 className="font-semibold">{title}</h3><p className="text-xs text-[#86868b]">{hint}</p></div><span className="text-xs text-[#86868b]">{scoped.filter((item) => item.done).length} / {scoped.length}</span></div><div className="grid gap-2">{scoped.map((reminder) => <div key={reminder.id} className="reminder-row"><Checkbox checked={reminder.done} disabled={!canEdit} onCheckedChange={(checked) => patch(reminder.id, { done: Boolean(checked) })} /><Input value={reminder.text} disabled={!canEdit} onChange={(event) => patch(reminder.id, { text: event.target.value })} className={reminder.done ? "line-through opacity-55" : ""} />{canEdit && <Button size="icon-sm" variant="ghost" aria-label="删除提醒" onClick={() => onChange(reminders.filter((item) => item.id !== reminder.id))}><Trash2 /></Button>}</div>)}</div>{canEdit && <Button className="mt-3" size="sm" variant="outline" onClick={() => onChange([...reminders, { id: `reminder-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, text: "新的提醒事项", done: false, scope }])}><Plus /> 添加提醒</Button>}</section>;
}

function weatherLabel(code: number) {
  if (code === 0) return "晴朗";
  if (code <= 3) return "多云";
  if (code === 45 || code === 48) return "雾";
  if (code >= 71 && code <= 77) return "降雪";
  if (code >= 85) return "阵雪 / 阵雨";
  if (code >= 51) return "有雨";
  return "天气变化";
}
