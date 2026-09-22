import {env} from "cloudflare:workers";
import {sha256} from "./auth";
export async function authAllowed(request:Request){
 if(!env.DB)return false;
 const id="auth:"+await sha256(request.headers.get("cf-connecting-ip")||"local");
 const now=Date.now();
 const result=await env.DB.prepare("INSERT INTO service_limits (id,next_at) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET next_at=excluded.next_at WHERE service_limits.next_at<=?").bind(id,now+1800,now).run();
 // Remove expired entries without recording any address.
 await env.DB.prepare("DELETE FROM service_limits WHERE next_at < ?").bind(now-86400000).run();
 return !!result.meta.changes;
}
