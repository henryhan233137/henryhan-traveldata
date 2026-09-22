export type TravelStop = {
  nativeName?: string;
  address?: string;
  sourceUrl?: string;
  verifiedAt?: string;
  durationMinutes?: number;
  openingHours?: string;
  time: string;
  title: string;
  kind: "文化" | "风景" | "美食" | "购物" | "交通" | "经典场景";
  note: string;
  location?: { lat: number; lng: number };
  transportFromPrevious?: string;
  ticketRequired?: boolean;
  ticketNote?: string;
  ticketDone?: boolean;
};

export type TripReminder = {
  id: string;
  text: string;
  done: boolean;
  scope: "common" | string;
};

export type TravelDay = {
  no: string;
  city: string;
  title: string;
  summary: string;
  stops: TravelStop[];
};

export type TransportPlan = {
  id: string;
  type: "飞机" | "KTX" | "机场交通" | "火车" | "地铁" | "公交" | "出租车" | "自驾" | "轮渡" | "步行";
  arrival?: string;
  departureTimezone?: string;
  arrivalTimezone?: string;
  terminal?: string;
  seat?: string;
  baggage?: string;
  memberIds?: string[];
  attachment?: string;
  status: "待确认" | "已录入";
  from: string;
  to: string;
  date: string;
  service: string;
  detail: string;
};

export type TripMember = {
  accountId?: string;
  permission?: "viewer" | "editor" | "admin";
  archived?: boolean;
  startDate?: string;
  endDate?: string;
  id: string;
  name: string;
  email: string;
  color: string;
  ledgerAccess: boolean;
};

export type LedgerCategory = "美食" | "交通" | "住宿" | "门票" | "购物" | "其他";

export type LedgerBill = {
  id: string;
  originalAmountCents: number;
  baseAmountCents: number;
  currency: "CNY" | "KRW" | "USD" | "JPY" | "EUR" | "GBP" | "HKD";
  splitMode?: "equal" | "amount" | "percent" | "shares";
  splitValues?: Record<string, number>;
  payments?: Record<string, number>;
  refund?: boolean;
  voided?: boolean;
  receipt?: string;
  day?: string;
  exchangeRate: number;
  category: LedgerCategory;
  note: string;
  payerId: string;
  participantIds: string[];
  orderedAt: string;
  createdAt: string;
};

export type TripLedger = {
  baseCurrency: "CNY" | "KRW" | "USD" | "JPY" | "EUR" | "GBP" | "HKD";
  bills: LedgerBill[];
  repayments?: { id: string; fromId: string; toId: string; amount: number; confirmed: boolean; date: string }[];
};

export type TripSnapshot = {
  history?: { at: string; actor: string; action: string }[];
  title: string;
  monthRange: string;
  exactStart: string;
  exactEnd: string;
  travelers: number;
  members: TripMember[];
  selectedRoute: "openjaw" | "round";
  preferences: string[];
  days: TravelDay[];
  transports: TransportPlan[];
  budget: { category: string; estimate: number }[];
  ledger: TripLedger;
  preTripReminders: TripReminder[];
  notes: string;
};

export const defaultTrip: TripSnapshot = {
  title: "冬日双城行动档案",
  monthRange: "2026年12月—2027年1月",
  exactStart: "",
  exactEnd: "",
  travelers: 4,
  members: [
    { id: "henry", name: "Henry", email: "", color: "#F1464E", ledgerAccess: true },
    { id: "member-a", name: "同行人 A", email: "", color: "#287B90", ledgerAccess: true },
    { id: "member-b", name: "同行人 B", email: "", color: "#C58B32", ledgerAccess: true },
    { id: "member-c", name: "同行人 C", email: "", color: "#8B6AA8", ledgerAccess: true },
  ],
  selectedRoute: "openjaw",
  preferences: ["文化", "风景", "经典场景", "美食", "购物"],
  days: [
    {
      no: "01", city: "首尔", title: "抵达 · 城市初见", summary: "仁川机场 → 明洞 → 南山夜景",
      stops: [
        { time: "抵达后", title: "仁川机场入境与交通", kind: "交通", note: "优先机场铁路 AREX；四人行李较多时再比较包车。", location: { lat: 37.4602, lng: 126.4407 }, transportFromPrevious: "国际航班 · NKG → ICN" },
        { time: "傍晚", title: "明洞与南大门商圈", kind: "购物", note: "换汇、补给、护肤品与街头小吃集中完成。", location: { lat: 37.5609, lng: 126.986 }, transportFromPrevious: "AREX + 地铁 · 约 65 分钟" },
        { time: "夜间", title: "南山首尔塔夜景", kind: "风景", note: "视到达时间与天气调整；风雪天改为室内观景。", location: { lat: 37.5512, lng: 126.9882 }, transportFromPrevious: "步行 / 巴士 · 约 25 分钟", ticketRequired: true, ticketNote: "观景台建议提前购票" },
      ],
    },
    {
      no: "02", city: "首尔", title: "宫阙与街巷", summary: "景福宫 → 北村 → 仁寺洞 → 广藏市场",
      stops: [
        { time: "09:00", title: "景福宫与韩服体验", kind: "文化", note: "穿韩服游宫阙；出发前复核休宫日和换岗仪式。", location: { lat: 37.5796, lng: 126.977 }, transportFromPrevious: "地铁 · 约 20 分钟", ticketRequired: true, ticketNote: "宫殿门票与韩服体验分开预约" },
        { time: "12:00", title: "北村韩屋村 · 仁寺洞", kind: "经典场景", note: "以步行为主，注意居民区安静游览规则。", location: { lat: 37.5826, lng: 126.983 }, transportFromPrevious: "步行 · 约 18 分钟" },
        { time: "17:30", title: "广藏市场晚餐", kind: "美食", note: "绿豆煎饼、紫菜包饭、生拌牛肉分食，避开单一网红摊排长队。", location: { lat: 37.5701, lng: 126.9996 }, transportFromPrevious: "步行 + 地铁 · 约 25 分钟" },
      ],
    },
    {
      no: "03", city: "首尔 → 釜山", title: "潮流与转场", summary: "圣水洞 → 首尔站 → KTX → 西面",
      stops: [
        { time: "09:30", title: "圣水洞街区", kind: "购物", note: "设计店、咖啡店与快闪集中，预留自由活动。", location: { lat: 37.5445, lng: 127.0557 }, transportFromPrevious: "地铁 · 约 30 分钟" },
        { time: "14:00", title: "首尔站乘 KTX", kind: "交通", note: "建议预留 30 分钟进站；四人尽量连座。", location: { lat: 37.5547, lng: 126.9707 }, transportFromPrevious: "地铁 · 约 28 分钟", ticketRequired: true, ticketNote: "KTX 建议提前选座购票" },
        { time: "18:00", title: "釜山西面晚餐", kind: "美食", note: "猪肉汤饭或烤肉，入住后安排轻量夜游。", location: { lat: 35.1578, lng: 129.0596 }, transportFromPrevious: "KTX · 约 2 小时 30 分钟" },
      ],
    },
    {
      no: "04", city: "釜山", title: "山海电影感", summary: "甘川文化村 → 松岛 → 南浦洞 → 札嘎其",
      stops: [
        { time: "09:00", title: "甘川文化村", kind: "经典场景", note: "从高处向下游览，减少冬季坡道折返。", location: { lat: 35.0975, lng: 129.0106 }, transportFromPrevious: "地铁 + 巴士 · 约 45 分钟" },
        { time: "13:00", title: "松岛海岸", kind: "风景", note: "按风力选择海岸步道或缆车，强风时缩短户外停留。", location: { lat: 35.0776, lng: 129.017 }, transportFromPrevious: "巴士 / 出租车 · 约 20 分钟", ticketRequired: true, ticketNote: "乘坐缆车时建议提前购票" },
        { time: "17:00", title: "国际市场 · 札嘎其市场", kind: "美食", note: "市场、海鲜与南浦洞购物合并为连续步行线路。", location: { lat: 35.0967, lng: 129.0305 }, transportFromPrevious: "巴士 · 约 18 分钟" },
      ],
    },
    {
      no: "05", city: "釜山", title: "海岸收尾", summary: "海云台 → 青沙浦 → 金海机场",
      stops: [
        { time: "08:30", title: "海云台海岸散步", kind: "风景", note: "冬日晨间体感低，按返程航班压缩或顺延。", location: { lat: 35.1587, lng: 129.1604 }, transportFromPrevious: "地铁 · 约 35 分钟" },
        { time: "10:30", title: "青沙浦与海岸列车", kind: "经典场景", note: "如返程较早则取消，避免跨城交通过紧。", location: { lat: 35.1615, lng: 129.191 }, transportFromPrevious: "海岸列车 · 约 20 分钟", ticketRequired: true, ticketNote: "热门时段需预约海岸列车" },
        { time: "返程前", title: "金海机场", kind: "交通", note: "国际航班建议至少提前 3 小时抵达。", location: { lat: 35.1796, lng: 128.9382 }, transportFromPrevious: "地铁 / 出租车 · 约 60 分钟" },
      ],
    },
  ],
  transports: [
    { id: "outbound", type: "飞机", status: "待确认", from: "南京禄口 NKG", to: "首尔仁川 ICN", date: "日期待定", service: "航班待比价", detail: "优先直飞 · 含托运行李" },
    { id: "ktx", type: "KTX", status: "待确认", from: "首尔站", to: "釜山站", date: "第3天", service: "KTX 班次待选", detail: "约 2小时30分 · 四人连座" },
    { id: "return", type: "飞机", status: "待确认", from: "釜山金海 PUS", to: "南京禄口 NKG", date: "日期待定", service: "直飞优先", detail: "无合适班次时切换首尔返程" },
  ],
  budget: [
    { category: "国际机票", estimate: 12000 },
    { category: "住宿", estimate: 7200 },
    { category: "KTX与市内交通", estimate: 2400 },
    { category: "餐饮", estimate: 5000 },
    { category: "门票与体验", estimate: 1800 },
    { category: "购物机动", estimate: 4000 },
  ],
  ledger: { baseCurrency: "CNY", bills: [] },
  preTripReminders: [
    { id: "passport", text: "检查护照有效期与韩国入境要求", done: false, scope: "common" },
    { id: "flight", text: "确定往返航班并录入行李额度", done: false, scope: "common" },
    { id: "ktx", text: "购买首尔至釜山 KTX 连座车票", done: false, scope: "common" },
    { id: "tickets", text: "预订首尔塔、松岛缆车与海岸列车", done: false, scope: "common" },
    { id: "network", text: "准备自己的韩国上网卡和常用支付方式", done: false, scope: "henry" },
  ],
  notes: "冬季室内外温差较大，建议分层穿衣并准备防风外套。\n跨城日尽量少安排购物，四人行李需要预留电梯和进站时间。\n热门场馆及体验项目以官方网站的开放时间与预约规则为准。\n护照、电子票、酒店订单建议同时保存到手机离线文件。",
};

// Names checked against the linked official sources. Combined neighbourhood
// stops deliberately remain unverified until split into individual places.
const verifiedPlaces: Record<string, Pick<TravelStop,"nativeName"|"address"|"sourceUrl"|"verifiedAt">> = {
 "仁川机场入境与交通": {nativeName:"인천국제공항",sourceUrl:"https://www.airport.kr/ap_ko/index.do",verifiedAt:"2026-09-22"},
 "南山首尔塔夜景": {nativeName:"남산서울타워",address:"서울 용산구 남산공원길 105",sourceUrl:"https://korean.visitseoul.net/attractions/남산서울타워/KOP000036",verifiedAt:"2026-09-22"},
 "海云台海岸散步": {nativeName:"해운대해수욕장",address:"부산광역시 해운대구 해운대해변로 264",sourceUrl:"https://www.visitbusan.net/archive/dataSearch/view.nm?dataSid=METADATA009458",verifiedAt:"2026-09-22"},
 "金海机场": {nativeName:"김해국제공항",sourceUrl:"https://www.airport.co.kr/gimhae/",verifiedAt:"2026-09-22"},
};
for (const day of defaultTrip.days) for (const stop of day.stops) Object.assign(stop,verifiedPlaces[stop.title]||{});
export function normalizeTripSnapshot(input: Partial<TripSnapshot> | null | undefined): TripSnapshot {
  const source = input ?? {};
  return {
    ...defaultTrip,
    ...source,
    members: Array.isArray(source.members) ? source.members : defaultTrip.members,
    ledger: source.ledger && Array.isArray(source.ledger.bills) ? source.ledger : defaultTrip.ledger,
    days: Array.isArray(source.days)
      ? source.days.map((day) => ({
          ...day,
          stops: day.stops.map((stop) => ({
            ...(!stop.nativeName && defaultTrip.days.some(d=>d.stops.some(s=>s.title===stop.title&&s.location&&stop.location&&Math.abs(s.location.lat-stop.location.lat)<.002&&Math.abs(s.location.lng-stop.location.lng)<.002))?verifiedPlaces[stop.title]:{}),
            ...stop,
          })),
        }))
      : defaultTrip.days,
    transports: Array.isArray(source.transports) ? source.transports : defaultTrip.transports,
    budget: Array.isArray(source.budget) ? source.budget : defaultTrip.budget,
    preTripReminders: Array.isArray(source.preTripReminders)
      ? source.preTripReminders.map((item) => ({ ...item, scope: item.scope || "common" }))
      : defaultTrip.preTripReminders,
    notes: typeof source.notes === "string" ? source.notes : defaultTrip.notes,
  };
}
