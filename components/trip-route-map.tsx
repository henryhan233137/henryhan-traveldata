"use client";

import { Minus, Plus, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { TravelDay } from "@/lib/trip-data";

type MapPoint = {
  id: string;
  day: number;
  index: number;
  title: string;
  x: number;
  y: number;
};

function project(lat: number, lng: number) {
  if (lat > 36) {
    return {
      x: 85 + ((lng - 126.38) / .72) * 360,
      y: 90 + ((37.68 - lat) / .3) * 220,
    };
  }
  return {
    x: 505 + ((lng - 128.9) / .32) * 310,
    y: 335 + ((35.25 - lat) / .2) * 205,
  };
}

export function TripRouteMap({ days }: { days: TravelDay[] }) {
  const [selectedDay, setSelectedDay] = useState<number | "all">("all");
  const [zoom, setZoom] = useState(1);

  const points = useMemo<MapPoint[]>(() => days.flatMap((day, dayIndex) =>
    day.stops.flatMap((stop, stopIndex) => {
      if (!stop.location) return [];
      const { x, y } = project(stop.location.lat, stop.location.lng);
      return [{
        id: `${day.no}-${stopIndex}`,
        day: dayIndex,
        index: stopIndex,
        title: stop.title,
        x,
        y,
      }];
    }),
  ), [days]);

  const visible = selectedDay === "all" ? points : points.filter((point) => point.day === selectedDay);
  const segments = visible.slice(1).map((point, index) => ({ id: `${visible[index].id}-${point.id}`, from: visible[index], to: point }));
  const width = 900 / zoom;
  const height = 600 / zoom;
  const viewBox = `${450 - width / 2} ${300 - height / 2} ${width} ${height}`;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="选择路线日期">
          <button className={`map-filter ${selectedDay === "all" ? "map-filter-active" : ""}`} onClick={() => setSelectedDay("all")}>总路线</button>
          {days.map((day, index) => <button key={day.no} className={`map-filter ${selectedDay === index ? "map-filter-active" : ""}`} onClick={() => setSelectedDay(index)}>D{index + 1}</button>)}
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-black/20 p-1">
          <Button size="icon-sm" variant="ghost" aria-label="缩小地图" onClick={() => setZoom((value) => Math.max(1, value - .25))}><Minus /></Button>
          <span className="min-w-12 text-center text-xs font-bold text-[#a8b9cc]">{Math.round(zoom * 100)}%</span>
          <Button size="icon-sm" variant="ghost" aria-label="放大地图" onClick={() => setZoom((value) => Math.min(2.5, value + .25))}><Plus /></Button>
          <Button size="icon-sm" variant="ghost" aria-label="重置地图" onClick={() => setZoom(1)}><RotateCcw /></Button>
        </div>
      </div>

      <div className="interactive-map-shell">
        <svg className="interactive-map" viewBox={viewBox} role="img" aria-label="首尔和釜山手绘风格行程路线地图">
          <defs>
            <pattern id="map-paper" width="30" height="30" patternUnits="userSpaceOnUse"><path d="M0 11 C8 8 20 14 30 10 M0 24 C11 20 21 28 30 23" fill="none" stroke="#8a877a" strokeOpacity=".055" strokeWidth="1" /></pattern>
            <filter id="map-shadow"><feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#29394c" floodOpacity=".18" /></filter>
          </defs>
          <rect width="900" height="600" fill="#f4f0e5" />
          <rect width="900" height="600" fill="url(#map-paper)" />
          <path d="M70 75 C170 35 355 45 465 105 C500 165 468 272 382 310 C240 330 110 290 65 206 C42 157 44 108 70 75Z" fill="#ebe8d8" stroke="#6f756f" strokeWidth="2" />
          <path d="M470 315 C565 278 741 292 836 360 C870 420 838 522 762 558 C635 575 508 536 475 464 C451 413 448 356 470 315Z" fill="#e8eadc" stroke="#6f756f" strokeWidth="2" />
          <path d="M35 335 C150 285 270 330 354 420 C278 520 160 578 34 560Z" fill="#b8d9e8" opacity=".72" />
          <path d="M650 40 C760 60 850 125 900 205 L900 0 L650 0Z" fill="#b8d9e8" opacity=".6" />
          <text x="82" y="108" className="map-region-title">SEOUL · 首尔</text>
          <text x="490" y="350" className="map-region-title">BUSAN · 釜山</text>

          {segments.map((segment) => <g key={segment.id}>
            <line x1={segment.from.x} y1={segment.from.y} x2={segment.to.x} y2={segment.to.y} stroke="#fff" strokeOpacity=".65" strokeWidth="10" strokeLinecap="round" />
            <line x1={segment.from.x} y1={segment.from.y} x2={segment.to.x} y2={segment.to.y} stroke="#163b69" strokeWidth="4" strokeLinecap="round" strokeDasharray={Math.abs(segment.from.y - segment.to.y) > 170 ? "3 10" : undefined} />
          </g>)}

          {visible.map((point, visibleIndex) => {
            const alignLeft = point.x > 735;
            return <g key={point.id} transform={`translate(${point.x},${point.y})`} className="map-point">
              <circle r="15" fill="#163b69" stroke="#f4f0e5" strokeWidth="4" filter="url(#map-shadow)" />
              <text textAnchor="middle" y="5" className="map-number">{visibleIndex + 1}</text>
              <text x={alignLeft ? -18 : 18} textAnchor={alignLeft ? "end" : "start"} y="-10" className="map-place-label">{point.title}</text>
              <text x={alignLeft ? -18 : 18} textAnchor={alignLeft ? "end" : "start"} y="8" className="map-place-meta">D{point.day + 1} · {days[point.day]?.stops[point.index]?.time}</text>
            </g>;
          })}
        </svg>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs leading-5 text-[#8599af]">
        <span>编号按行程顺序排列；路线为行程示意。</span>
        <span>实际导航请使用每天景点旁的 Google 地图入口。</span>
      </div>
    </div>
  );
}
