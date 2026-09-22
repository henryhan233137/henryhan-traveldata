import { NextResponse } from "next/server";
import { env } from "cloudflare:workers";
import { getAppUser,isOwnerEmail,assertSameOrigin } from "@/lib/auth";
import { allJourneys,journey,createJourney,updateJourney } from "@/db/journeys";
import { defaultTrip } from "@/lib/trip-data";
import { tripSchema,ledgerSchema,reminderSchema,parseImport } from "@/lib/travel-schema";
import { permissions,forViewer } from "@/lib/trip-access";
import { validateLedger } from "@/lib/ledger-math";
export const dynamic="force-dynamic";
const fail=(error:string,status=400)=>NextResponse.json({error},{status});
export async function GET(request:Request){
 const user=await getAppUser();if(!user)return fail("请先登录",401);
 const owner=isOwnerEmail(user.email);
 try{
  const id=new URL(request.url).searchParams.get("id");
  const rows=id?[await journey(id)].filter((r):r is NonNullable<typeof r>=>!!r):await allJourneys();
  const allowed=rows.filter(r=>permissions(r.trip,user,owner).view);
  if(id&&!allowed.length)return fail("没有本次旅行的访问权限",403);
  return NextResponse.json({owner,user:{id:user.userId,email:user.email,name:user.displayName},
   journeys:allowed.map(r=>{const p=permissions(r.trip,user,owner);return {id:r.id,revision:r.revision,permissions:p,trip:forViewer(r.trip,p.memberId,!!p.manage)};})},
   {headers:{"cache-control":"private, no-store"}});
 }catch{return fail("旅行读取失败，请稍后重试",503);}
}
export async function POST(request:Request){
 if(!assertSameOrigin(request))return fail("无效来源",403);
 const user=await getAppUser();if(!user)return fail("请先登录",401);
 const owner=isOwnerEmail(user.email);
 try{
  const raw=await request.text();if(new TextEncoder().encode(raw).length>1_200_000)return fail("单次旅行含附件不能超过 1.2MB，请减少票据图片",413);
  const body=JSON.parse(raw);
  if(body.action==="create"){
   if(!owner)return fail("只有创建者可以新建旅行",403);
   if((await allJourneys()).length>=40)return fail("已达到免费版本的 40 次旅行上限，请先导出备份");
   const t=body.seed?tripSchema.parse(structuredClone(defaultTrip)):parseImport(body.trip);
   t.members=t.members.map((m,i)=>i===0?{...m,email:user.email,accountId:user.userId,permission:"admin" as const}: {...m,accountId:undefined});
   if(!t.members.length)t.members.push({id:crypto.randomUUID(),name:user.displayName,email:user.email,color:"#0071e3",ledgerAccess:true,accountId:user.userId,permission:"admin"});
   t.travelers=t.members.filter(m=>!m.archived).length;
   const created=await createJourney(user.userId,t);return NextResponse.json({ok:true,id:created.id});
  }
  if(typeof body.id!=="string")return fail("缺少旅行编号");
  const current=await journey(body.id);if(!current)return fail("旅行不存在",404);
  const p=permissions(current.trip,user,owner);if(!p.view)return fail("无权访问",403);
  if(body.revision!==current.revision)return fail("其他成员已更新此旅行。请先下载本地草稿，再重新载入最新版本。",409);
  let next=structuredClone(current.trip);
  let action="";
  if(body.action==="plan"){
   if(!p.edit)return fail("只读成员不能编辑行程",403);
   const submitted=tripSchema.parse(body.trip);
   next={...submitted,members:current.trip.members,ledger:current.trip.ledger,preTripReminders:current.trip.preTripReminders,history:current.trip.history};
   action="编辑行程、交通或注意事项";
  }else if(body.action==="members"){
   if(!p.manage)return fail("仅旅行管理员可以管理成员",403);
   const submitted=tripSchema.shape.members.parse(body.members);
   if(new Set(submitted.map(m=>m.id)).size!==submitted.length)return fail("成员编号重复");
   const assigned=submitted.filter(m=>m.accountId).map(m=>m.accountId);
   if(new Set(assigned).size!==assigned.length)return fail("同一个账号不能绑定两位成员");
   for(const m of submitted){
    if(m.accountId){
     const account=await env.DB!.prepare("SELECT email,disabled FROM app_users WHERE id=?").bind(m.accountId).first<{email:string;disabled:number}>();
     if(!account||account.disabled||account.email.toLowerCase()!==m.email.toLowerCase())return fail("绑定失败：请选择已注册且启用的对应邮箱账号");
    }
   }
   // Archive instead of destroying historical ledger/person reminder references.
   const removed=current.trip.members.filter(m=>!submitted.some(n=>n.id===m.id)).map(m=>({...m,archived:true,accountId:undefined}));
   next.members=[...submitted,...removed];next.travelers=submitted.filter(m=>!m.archived).length;
   if(!owner&&!next.members.some(m=>m.accountId===user.userId&&!m.archived&&m.permission==="admin"))return fail("不能移除自己的管理权限，请由创建者操作");
   action="调整成员或审批账号";
  }else if(body.action==="ledger"){
   if(!p.ledger)return fail("没有记账权限",403);
   const ledger=ledgerSchema.parse(body.ledger);validateLedger(ledger,current.trip.members);
   if(ledger.baseCurrency!==current.trip.ledger.baseCurrency&&(current.trip.ledger.bills.length||(current.trip.ledger.repayments||[]).length))return fail("已有账目时不能更换结算币种");
   for(const repayment of ledger.repayments||[]){
    const prev=current.trip.ledger.repayments?.find(r=>r.id===repayment.id);
    if(prev?.confirmed&&JSON.stringify(prev)!==JSON.stringify(repayment))return fail("已确认还款不能修改");
    if(!p.manage){
     if(!prev&&repayment.fromId!==p.memberId)return fail("只能登记自己付出的还款");
     if(prev&&prev.fromId!==p.memberId&&JSON.stringify({...prev,confirmed:false})!==JSON.stringify({...repayment,confirmed:false}))return fail("不能修改他人的还款金额或参与人");
     if(repayment.confirmed&&!prev?.confirmed&&repayment.toId!==p.memberId)return fail("只有收款人可以确认收款");
    }
   }
   if(current.trip.ledger.repayments?.some(old=>!ledger.repayments?.some(n=>n.id===old.id)))return fail("还款记录不能删除");
   next.ledger=ledger;action="更新账单或还款";
  }else if(body.action==="reminders"){
   if(!p.memberId)return fail("请先将自己的账号绑定到同行成员",403);
   const submitted=reminderSchema.array().max(300).parse(body.reminders);
   const editable=new Set(p.manage?["common",p.memberId]:[p.memberId]);
   next.preTripReminders=[...current.trip.preTripReminders.filter(r=>!editable.has(r.scope)),...submitted.filter(r=>editable.has(r.scope))];
   action=p.manage?"更新提醒事项":`个人提醒:${p.memberId}`;
  }else if(body.action==="ticket"){
   if(!p.edit)return fail("只读成员不能修改预约",403);
   const {day,stop,done}=body;if(!Number.isInteger(day)||!Number.isInteger(stop)||typeof done!=="boolean"||!next.days[day]?.stops[stop])return fail("预约项目无效");
   next.days[day].stops[stop].ticketDone=done;action="更新预约状态";
  }else return fail("未知操作");
  next.history=[...(current.trip.history||[]),{at:new Date().toISOString(),actor:user.displayName,action}].slice(-100);
  if(new TextEncoder().encode(JSON.stringify(next)).length>1_200_000)return fail("旅行空间已满，请减少图片附件",413);
  const result=await updateJourney(current,next);if(!result)return fail("保存冲突，请重新载入后再试",409);
  return NextResponse.json({ok:true,revision:result.revision,trip:forViewer(next,p.memberId,!!p.manage)});
 }catch(error){return fail(error instanceof Error?error.message.slice(0,350):"操作失败，请检查输入");}
}
