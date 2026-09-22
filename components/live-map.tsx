"use client";
import { useEffect,useRef,useState } from "react";
import type { Map as LMap, LayerGroup } from "leaflet";
import type { TravelDay,TravelStop } from "@/lib/trip-data";
import { Button } from "@/components/ui/button";
import "leaflet/dist/leaflet.css";
export function LiveMap({days,onPick}:{days:TravelDay[];onPick?:(location:{lat:number;lng:number})=>void}){
 const el=useRef<HTMLDivElement>(null),map=useRef<LMap|null>(null),layer=useRef<LayerGroup|null>(null);
 const pick=useRef(onPick);pick.current=onPick;
 const [ready,setReady]=useState(false),[selected,setSelected]=useState("all"),[error,setError]=useState("");
 useEffect(()=>{let gone=false;void import("leaflet").then(L=>{
 if(gone||!el.current)return;
 const m=L.map(el.current,{scrollWheelZoom:true}).setView([37.5,127],7);map.current=m;
 L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).on("tileerror",()=>setError("底图暂时未加载，请检查网络；地点导航链接仍可使用。")).addTo(m);
 layer.current=L.layerGroup().addTo(m);
 m.on("click",e=>pick.current?.({lat:+e.latlng.lat.toFixed(6),lng:+e.latlng.lng.toFixed(6)}));
 setReady(true);
 const resize=new ResizeObserver(()=>m.invalidateSize());resize.observe(el.current);
 m.on("unload",()=>resize.disconnect());
 });return()=>{gone=true;map.current?.remove();map.current=null;};},[]);
 useEffect(()=>{if(!ready)return;void import("leaflet").then(L=>{
 const m=map.current,g=layer.current;if(!m||!g)return;g.clearLayers();
 const stops=(selected==="all"?days:days.filter((_,i)=>String(i)===selected)).flatMap(d=>d.stops).filter(s=>s.location);
 const coordinates=stops.map(s=>[s.location!.lat,s.location!.lng] as [number,number]);
 if(coordinates.length>1)L.polyline(coordinates,{color:"#0071e3",weight:3,opacity:.85}).addTo(g);
 stops.forEach((s,i)=>{const content=document.createElement("div");content.textContent=`${i+1}. ${s.title}\n${s.nativeName||""}\n${s.address||""}`;
 L.marker(coordinates[i],{icon:L.divIcon({className:"journey-marker",html:String(i+1),iconSize:[28,28]})}).bindPopup(content).addTo(g);});
 if(coordinates.length)m.fitBounds(L.latLngBounds(coordinates),{padding:[32,32],maxZoom:15});
 setTimeout(()=>m.invalidateSize(),50);
 });},[days,selected,ready]);
 return <section className="map-block"><div className="row wrap"><Button variant={selected==="all"?"default":"outline"} onClick={()=>setSelected("all")}>整段旅行</Button>{days.map((d,i)=><Button key={i} variant={selected===String(i)?"default":"outline"} onClick={()=>setSelected(String(i))}>第 {i+1} 天</Button>)}</div><div ref={el} className="geo-map" aria-label="可拖动缩放的真实地理地图"/>{error&&<p role="status">{error}</p>}<p className="muted">拖动或双指缩放可查看周边道路和地点。连线表示游览顺序，不是道路导航路线。{onPick&&"点击地图可选取坐标。"}</p></section>;
}
