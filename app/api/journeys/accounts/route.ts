import { NextResponse } from "next/server";
import { env } from "cloudflare:workers";
import { getAppUser,isOwnerEmail } from "@/lib/auth";
import { journey } from "@/db/journeys";
import { permissions } from "@/lib/trip-access";
export async function GET(request:Request){
 const user=await getAppUser();if(!user)return NextResponse.json({error:"请先登录"},{status:401});
 const params=new URL(request.url).searchParams;
 const trip=await journey(params.get("id")||"");
 if(!trip||!permissions(trip.trip,user,isOwnerEmail(user.email)).manage)return NextResponse.json({error:"没有管理权限"},{status:403});
 const email=(params.get("email")||"").trim().toLowerCase();
 if(!email)return NextResponse.json({users:[]});
 const result=await env.DB!.prepare("SELECT id,email,display_name AS name,created_at AS registeredAt FROM app_users WHERE email=? AND disabled=0").bind(email).all();
 return NextResponse.json({users:result.results},{headers:{"cache-control":"private,no-store"}});
}
