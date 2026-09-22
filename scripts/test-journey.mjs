import assert from "node:assert/strict";
import fs from "node:fs";
import {createRequire} from "node:module";
import test from "node:test";
const require=createRequire(import.meta.url),ts=require("typescript");
function moduleAt(path){const m={exports:{}};new Function("require","module","exports",ts.transpileModule(fs.readFileSync(new URL("../"+path,import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(require,m,m.exports);return m.exports;}
const {allocate,portions,contributions,balances,validateLedger}=moduleAt("lib/ledger-math.ts");
const {permissions,forViewer}=moduleAt("lib/trip-access.ts");
const {parseImport}=moduleAt("lib/travel-schema.ts");
const members=["a","b","c"].map(id=>({id,name:id,email:id+"@example.com",accountId:id,permission:"viewer",ledgerAccess:true}));
const bill={id:"b",originalAmountCents:10000,baseAmountCents:10000,exchangeRate:1,payerId:"a",participantIds:["a","b","c"]};
test("rounding conserves every cent over varying group sizes",()=>{for(let n=1;n<=100;n++){const ids=Array.from({length:n},(_,i)=>String(i));for(const total of [1,5,100,10001])assert.equal(Object.values(allocate(total,ids,ids.map(()=>1))).reduce((a,b)=>a+b,0),total);}});
test("custom portions, percentages and multiple payers",()=>{assert.deepEqual(portions({...bill,splitMode:"amount",splitValues:{a:20,b:30,c:50}}),{a:2000,b:3000,c:5000});assert.throws(()=>portions({...bill,splitMode:"percent",splitValues:{a:30,b:30,c:30}}));assert.deepEqual(contributions({...bill,payments:{a:4000,b:6000}}),{a:4000,b:6000});});
test("repayment clears debts only after receiving confirmation",()=>{const b={...bill,participantIds:["a","b"]},p={id:"p",fromId:"b",toId:"a",amount:5000,confirmed:false};assert.equal(balances(members,{baseCurrency:"CNY",bills:[b],repayments:[p]})[1].net,-5000);assert.equal(balances(members,{baseCurrency:"CNY",bills:[b],repayments:[{...p,confirmed:true}]})[1].net,0);});
test("refunds reverse balances and voids do not contribute",()=>{assert.equal(balances(members,{bills:[bill,{...bill,id:"refund",refund:true}],baseCurrency:"CNY"})[0].net,0);assert.equal(balances(members,{bills:[{...bill,voided:true}],baseCurrency:"CNY"})[0].net,0);});
test("invalid exchange calculations and missing members rejected",()=>{assert.throws(()=>validateLedger({bills:[{...bill,baseAmountCents:1}]},members));assert.throws(()=>validateLedger({bills:[{...bill,payerId:"intruder"}]},members));});
test("knowing an invited email does not grant access without account approval",()=>{const trip={members:[{...members[0],accountId:undefined}],preTripReminders:[]};assert.equal(permissions(trip,{userId:"a",email:"a@example.com"},false).view,false);});
test("private reminders filtered for owner and members",()=>{const trip={members,preTripReminders:[{scope:"common"},{scope:"a"},{scope:"b"}],history:[]};assert.deepEqual(forViewer(trip,"a",true).preTripReminders.map(r=>r.scope),["common","a"]);assert.equal(permissions({...trip,members:[{...members[0],archived:true}]},{userId:"a",email:"a@example.com"},false).view,false);});
test("imports cannot grant accounts or include personal reminders",()=>{const raw=JSON.parse(fs.readFileSync(new URL("../public/travel-import-template.json",import.meta.url)));raw.trip.members[0].accountId="attacker";raw.trip.preTripReminders.push({id:"p",text:"private",done:false,scope:"creator"});const t=parseImport(raw);assert.equal(t.members[0].accountId,undefined);assert.equal(t.preTripReminders.length,1);assert.throws(()=>parseImport({version:99,trip:raw.trip}));});
