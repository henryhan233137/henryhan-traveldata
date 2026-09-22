import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { getAppUser,isOwnerEmail,assertSameOrigin,sha256 } from "@/lib/auth";
export async function POST(request:Request){
 if(!assertSameOrigin(request))return NextResponse.json({error:"无效来源"},{status:403});
 const user=await getAppUser();if(!user||!isOwnerEmail(user.email)||!env.DB)return NextResponse.json({error:"仅创建者可以生成恢复码"},{status:403});
 const code=Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,"0")).join("").toUpperCase();
 const now=new Date(),expires=new Date(now.getTime()+365*86400000);
 await env.DB.batch([
 env.DB.prepare("DELETE FROM password_reset_codes WHERE user_id=?").bind(user.userId),
 env.DB.prepare("INSERT INTO password_reset_codes (code_hash,user_id,expires_at,created_at) VALUES (?,?,?,?)").bind(await sha256(code),user.userId,expires.toISOString(),now.toISOString())]);
 return NextResponse.json({code,expires:expires.toISOString()},{headers:{"cache-control":"no-store"}});
}
