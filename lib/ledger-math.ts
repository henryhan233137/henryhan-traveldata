import type { LedgerBill, TripLedger, TripMember } from "./trip-data";
export function allocate(total:number, ids:string[], weights:number[]) {
 if(!Number.isSafeInteger(total)||total<0||!ids.length||new Set(ids).size!==ids.length||weights.some(w=>!Number.isFinite(w)||w<0)||weights.reduce((a,b)=>a+b,0)<=0) throw new Error("分摊人数或金额无效");
 const sum=weights.reduce((a,b)=>a+b,0);
 const exact=weights.map(w=>total*w/sum), result=exact.map(Math.floor);
 let remainder=total-result.reduce((a,b)=>a+b,0);
 const order=exact.map((v,i)=>({i,f:v-result[i]})).sort((a,b)=>b.f-a.f||a.i-b.i);
 for(let i=0;i<remainder;i++)result[order[i%order.length].i]++;
 return Object.fromEntries(ids.map((id,i)=>[id,result[i]]));
}
export function portions(b:LedgerBill) {
 const mode=b.splitMode||"equal",ids=b.participantIds,values=ids.map(id=>b.splitValues?.[id]||0);
 const sum=values.reduce((a,b)=>a+b,0);
 if(mode==="percent"&&Math.abs(sum-100)>0.00001)throw new Error("分摊比例合计必须为 100%");
 if(mode==="amount"&&Math.abs(Math.round(sum*100)-b.originalAmountCents)>0)throw new Error("指定金额合计必须等于原币金额");
 return allocate(b.baseAmountCents,ids,mode==="equal"?ids.map(()=>1):values);
}
export function contributions(b:LedgerBill) {
 const p=b.payments&&Object.keys(b.payments).length?b.payments:{[b.payerId]:b.originalAmountCents};
 if(Object.values(p).some(v=>!Number.isSafeInteger(v)||v<0)||Object.values(p).reduce((a,b)=>a+b,0)!==b.originalAmountCents)throw new Error("各付款人的原币金额合计必须等于账单金额");
 return allocate(b.baseAmountCents,Object.keys(p),Object.values(p));
}
export function validateLedger(ledger:TripLedger,members:TripMember[]) {
 const ids=new Set(members.map(m=>m.id));
 const billIds=new Set<string>();
 for(const b of ledger.bills){
  if(billIds.has(b.id))throw new Error("账单编号重复");billIds.add(b.id);
  if([...b.participantIds,b.payerId,...Object.keys(b.payments||{})].some(id=>!ids.has(id)))throw new Error("账单引用了不存在的成员");
  if(!Number.isSafeInteger(b.baseAmountCents)||b.baseAmountCents!==Math.round(b.originalAmountCents*b.exchangeRate))throw new Error("换算金额与手动汇率不一致");
  portions(b);contributions(b);
 }
 const repaymentIds=new Set<string>();
 for(const p of ledger.repayments||[]){
  if(repaymentIds.has(p.id)||!ids.has(p.fromId)||!ids.has(p.toId)||p.fromId===p.toId||!Number.isSafeInteger(p.amount)||p.amount<=0)throw new Error("还款记录无效");
  repaymentIds.add(p.id);
 }
}
export function balances(members:TripMember[],ledger:TripLedger){
 return members.map(m=>{
  let paid=0,owed=0,repaid=0;
  for(const b of ledger.bills.filter(b=>!b.voided)){const s=b.refund?-1:1;paid+=(contributions(b)[m.id]||0)*s;owed+=(portions(b)[m.id]||0)*s;}
  for(const p of ledger.repayments||[])if(p.confirmed){if(p.fromId===m.id)repaid+=p.amount;if(p.toId===m.id)repaid-=p.amount;}
  return {...m,paid,owed,net:paid-owed+repaid};
 });
}
export function transfers(rows:ReturnType<typeof balances>){
 const debt=rows.filter(r=>r.net<0).map(r=>({id:r.id,left:-r.net}));
 const credit=rows.filter(r=>r.net>0).map(r=>({id:r.id,left:r.net}));
 const out:{fromId:string;toId:string;amount:number}[]=[];
 let i=0,j=0;
 while(i<debt.length&&j<credit.length){const amount=Math.min(debt[i].left,credit[j].left);out.push({fromId:debt[i].id,toId:credit[j].id,amount});debt[i].left-=amount;credit[j].left-=amount;if(!debt[i].left)i++;if(!credit[j].left)j++;}
 return out;
}
