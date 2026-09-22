import type {TripSnapshot} from "./trip-data";
export function scheduleWarnings(t:TripSnapshot){
 const warnings:string[]=[];
 const minutes=(s:string)=>/^\d{2}:\d{2}$/.test(s)?Number(s.slice(0,2))*60+Number(s.slice(3)):null;
 for(const [i,d] of t.days.entries())for(let n=1;n<d.stops.length;n++){
  const a=d.stops[n-1],b=d.stops[n],from=minutes(a.time),to=minutes(b.time);
  if(from!==null&&to!==null&&from+(a.durationMinutes||0)>to)warnings.push(`第 ${i+1} 天：“${a.title}”与“${b.title}”的时间可能重叠，请检查停留与交通时间。`);
 }
 if(t.exactStart&&t.exactEnd){const days=Math.round((Date.parse(t.exactEnd)-Date.parse(t.exactStart))/86400000)+1;if(days!==t.days.length)warnings.push(`日期跨度为 ${days} 天，但安排了 ${t.days.length} 天，请确认。`);}
 for(const v of t.transports){
  for(const z of [v.departureTimezone,v.arrivalTimezone])if(z)try{new Intl.DateTimeFormat("en",{timeZone:z}).format();}catch{warnings.push(`${v.service||v.type} 的时区“${z}”无效。`);}
 }
 return warnings;
}
