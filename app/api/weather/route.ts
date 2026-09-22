import { NextResponse } from "next/server";
import { getAppUser } from "@/lib/auth";
export async function GET(request:Request){
 if(!await getAppUser())return NextResponse.json({error:"请先登录"},{status:401});
 const params=new URL(request.url).searchParams,lat=Number(params.get("lat")),lng=Number(params.get("lng"));
 if(!params.has("lat")||!params.has("lng")||!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>85||Math.abs(lng)>180)return NextResponse.json({error:"请填写有效地点坐标"},{status:400});
 try{
 const query=new URLSearchParams({latitude:lat.toFixed(3),longitude:lng.toFixed(3),daily:"weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",timezone:"auto",forecast_days:"7"});
 const key=new Request("https://weather-cache.invalid/?"+query),cache=(caches as CacheStorage & {default:Cache}).default;
 const hit=await cache.match(key);if(hit)return hit;
 const r=await fetch("https://api.open-meteo.com/v1/forecast?"+query,{signal:AbortSignal.timeout(10000)});if(!r.ok)throw new Error();
 const {daily:d}=await r.json() as {daily:Record<string,(number|string)[]>};
 const response=NextResponse.json({days:d.time.map((date,i)=>({date,max:d.temperature_2m_max[i],min:d.temperature_2m_min[i],rain:d.precipitation_probability_max[i]}))},{headers:{"cache-control":"public,max-age=1800"}});
 await cache.put(key,response.clone());return response;
 }catch{return NextResponse.json({error:"免费天气服务暂不可用，请稍后重试"},{status:503});}
}
