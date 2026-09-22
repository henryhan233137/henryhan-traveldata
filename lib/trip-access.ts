import type { AppUser } from "./auth";
import type { TripSnapshot } from "./trip-data";
export function memberFor(trip:TripSnapshot,user:AppUser) {return trip.members.find(m=>m.accountId===user.userId&&!m.archived);}
export function permissions(trip:TripSnapshot,user:AppUser,owner:boolean) {
 const member=memberFor(trip,user);
 return {view:owner||!!member,manage:owner||member?.permission==="admin",
 edit:owner||member?.permission==="admin"||member?.permission==="editor",
 ledger:owner||Boolean(member?.ledgerAccess), memberId:member?.id??null};
}
export function forViewer(trip:TripSnapshot,memberId:string|null,manage:boolean){
 return {...trip,members:trip.members.map(m=>manage?m:{...m,email:"",accountId:undefined}),
 preTripReminders:trip.preTripReminders.filter(r=>r.scope==="common"||r.scope===memberId),
 history:(trip.history||[]).filter(h=>!h.action.startsWith("个人提醒")||h.action===`个人提醒:${memberId}`)};
}
