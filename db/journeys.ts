import { env } from "cloudflare:workers";
import { normalizeTripSnapshot,type TripSnapshot } from "@/lib/trip-data";
export type Journey={id:string;ownerId:string;trip:TripSnapshot;revision:string};
type Row={id:string;owner_id:string;snapshot:string;updated_at:string};
function decode(row:Row):Journey{return {id:row.id,ownerId:row.owner_id,trip:normalizeTripSnapshot(JSON.parse(row.snapshot)),revision:row.updated_at};}
export async function allJourneys(){if(!env.DB)throw new Error("数据库不可用");const rows=await env.DB.prepare("SELECT id,owner_id,snapshot,updated_at FROM trips ORDER BY updated_at DESC").all<Row>();return rows.results.map(decode);}
export async function journey(id:string){if(!env.DB)throw new Error("数据库不可用");const row=await env.DB.prepare("SELECT id,owner_id,snapshot,updated_at FROM trips WHERE id=?").bind(id).first<Row>();return row?decode(row):null;}
export async function createJourney(ownerId:string,trip:TripSnapshot,id=crypto.randomUUID()){
 if(!env.DB)throw new Error("数据库不可用");
 const revision=new Date().toISOString();
 await env.DB.prepare("INSERT INTO trips (id,owner_id,slug,visibility,title,snapshot,updated_at) VALUES (?,?,?,?,?,?,?)").bind(id,ownerId,id,"private",trip.title,JSON.stringify(trip),revision).run();
 return {id,ownerId,trip,revision};
}
export async function updateJourney(old:Journey,trip:TripSnapshot){
 if(!env.DB)throw new Error("数据库不可用");
 const revision=new Date(Math.max(Date.now(),Date.parse(old.revision)+1)).toISOString();
 const result=await env.DB.prepare("UPDATE trips SET title=?,snapshot=?,updated_at=? WHERE id=? AND updated_at=?").bind(trip.title,JSON.stringify(trip),revision,old.id,old.revision).run();
 if(!result.meta.changes)return null;
 return {...old,trip,revision};
}
