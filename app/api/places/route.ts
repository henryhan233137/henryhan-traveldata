import { NextResponse } from "next/server";
import { env } from "cloudflare:workers";
import { getAppUser,isOwnerEmail } from "@/lib/auth";
import { allJourneys } from "@/db/journeys";
import { permissions } from "@/lib/trip-access";
export async function GET(request:Request){
 const user=await getAppUser();
 if(!user)return NextResponse.json({error:"请先登录"},{status:401});
 if(!isOwnerEmail(user.email)&&!(await allJourneys()).some(j=>permissions(j.trip,user,false).edit))return NextResponse.json({error:"没有行程编辑权限"},{status:403});
 const q=new URL(request.url).searchParams.get("q")?.trim();
 if(!q||q.length>150)return NextResponse.json({error:"请输入地点名称、城市和国家"},{status:400});
 try{
 const key=new Request("https://places-cache.invalid/"+encodeURIComponent(q));
 const cache=(caches as CacheStorage & {default:Cache}).default;const cached=await cache.match(key);if(cached)return cached;
 const now=Date.now();
 const gate=await env.DB!.prepare("INSERT INTO service_limits (id,next_at) VALUES ('places',?) ON CONFLICT(id) DO UPDATE SET next_at=excluded.next_at WHERE service_limits.next_at<=?").bind(now+1500,now).run();
 if(!gate.meta.changes)return NextResponse.json({error:"搜索较频繁，请稍后再试"},{status:429});
 const upstream=await fetch("https://photon.komoot.io/api/?limit=5&q="+encodeURIComponent(q),{signal:AbortSignal.timeout(10000)});
 if(!upstream.ok)throw new Error();
 const data=await upstream.json() as {features:{geometry:{coordinates:number[]};properties:Record<string,string|number>}[]};
 const places=data.features.map(f=>{const p=f.properties;const type=({N:"node",W:"way",R:"relation"} as Record<string,string>)[String(p.osm_type)];return {name:String(p.name||q),address:[p.housenumber,p.street,p.city,p.state,p.country].filter(Boolean).join(", "),location:{lat:f.geometry.coordinates[1],lng:f.geometry.coordinates[0]},sourceUrl:type?"https://www.openstreetmap.org/"+type+"/"+p.osm_id:"https://www.openstreetmap.org"};});
 const response=NextResponse.json({places},{headers:{"cache-control":"public,max-age=86400"}});await cache.put(key,response.clone());return response;
 }catch{return NextResponse.json({error:"免费地点搜索暂不可用，请手动填写坐标或在地图上选点"},{status:503});}
}
