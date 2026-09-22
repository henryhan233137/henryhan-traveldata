import { z } from "zod";
const text = z.string().max(5000);
const id = z.string().min(1).max(100);
const email = z.union([z.literal(""), z.string().email().max(254)]);
const date = z.string().max(50);
const url = z.union([z.literal(""), z.string().url().refine(v => /^https?:\/\//i.test(v), "仅支持 HTTP/HTTPS 链接")]);
export const currencies = ["CNY","KRW","USD","JPY","EUR","GBP","HKD"] as const;
const amount = z.number().finite().nonnegative().max(1e12);
const image = z.string().max(180000).regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/);
export const billSchema = z.object({
 id, originalAmountCents: amount.int().positive(), baseAmountCents: amount.int().positive(),
 currency:z.enum(currencies), exchangeRate:z.number().finite().positive().max(1e8),
 category:z.enum(["美食","交通","住宿","门票","购物","其他"]), note:text,
 payerId:id, participantIds:z.array(id).min(1).max(100), orderedAt:date, createdAt:date,
 splitMode:z.enum(["equal","amount","percent","shares"]).optional(),
 splitValues:z.record(amount).optional(), payments:z.record(amount.int()).optional(),
 refund:z.boolean().optional(), voided:z.boolean().optional(), receipt:image.optional(), day:date.optional()
});
export const ledgerSchema = z.object({
 baseCurrency:z.enum(currencies), bills:z.array(billSchema).max(500),
 repayments:z.array(z.object({id,fromId:id,toId:id,amount:amount.int().positive(),confirmed:z.boolean(),date})).max(500).default([])
});
export const reminderSchema=z.object({id,text:z.string().min(1).max(2000),done:z.boolean(),scope:id});
export const tripSchema=z.object({
 title:z.string().min(1).max(150),monthRange:text,exactStart:date,exactEnd:date,travelers:z.number().int().nonnegative().max(100),
 selectedRoute:z.enum(["openjaw","round"]).default("openjaw"),preferences:z.array(text).max(30),
 members:z.array(z.object({id,name:z.string().min(1).max(80),email,color:z.string().regex(/^#[0-9a-fA-F]{6}$/),
 ledgerAccess:z.boolean(),accountId:id.optional(),permission:z.enum(["viewer","editor","admin"]).default("viewer"),
 archived:z.boolean().optional(),startDate:date.optional(),endDate:date.optional()})).max(100),
 days:z.array(z.object({no:date,city:text,title:text,summary:text,stops:z.array(z.object({
 time:date,title:z.string().min(1).max(200),kind:z.enum(["文化","风景","美食","购物","交通","经典场景"]),note:text,
 location:z.object({lat:z.number().finite().min(-85).max(85),lng:z.number().finite().min(-180).max(180)}).optional(),
 nativeName:text.optional(),address:text.optional(),sourceUrl:url.optional(),verifiedAt:date.optional(),
 durationMinutes:z.number().int().nonnegative().max(1440).optional(),openingHours:text.optional(),
 transportFromPrevious:text.optional(),ticketRequired:z.boolean().optional(),ticketNote:text.optional(),ticketDone:z.boolean().optional()
 })).max(100)})).max(90),
 transports:z.array(z.object({id,type:z.enum(["飞机","KTX","机场交通","火车","地铁","公交","出租车","自驾","轮渡","步行"]),
 status:z.enum(["待确认","已录入"]),from:text,to:text,date,service:text,detail:text,arrival:date.optional(),
 departureTimezone:text.optional(),arrivalTimezone:text.optional(),terminal:text.optional(),seat:text.optional(),baggage:text.optional(),
 memberIds:z.array(id).optional(),attachment:image.optional()})).max(150),
 ledger:ledgerSchema,preTripReminders:z.array(reminderSchema).max(300),notes:text,
 budget:z.array(z.object({category:text,estimate:z.number()})).max(50).default([]),
 history:z.array(z.object({at:date,actor:text,action:text})).max(100).optional()
});
export function parseImport(value: unknown) {
 const raw = value as {version?:number;trip?:unknown};
 if(raw?.version !== undefined && raw.version !== 1) throw new Error("不支持的导入版本，请使用版本 1");
 const trip=tripSchema.parse(raw?.trip ?? value);
 // Imported content never grants account access or brings another person's private notes.
 trip.members=trip.members.map(m=>({...m,accountId:undefined,permission:"viewer"}));
 trip.preTripReminders=trip.preTripReminders.filter(r=>r.scope==="common");
 trip.ledger={baseCurrency:trip.ledger.baseCurrency,bills:[],repayments:[]};
 trip.history=[];
 return trip;
}
