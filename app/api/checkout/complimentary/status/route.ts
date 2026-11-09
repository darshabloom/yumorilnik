import {createHash} from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
import {liveServices,NYE_EVENT_ID} from "@/lib/stripeLiveCheckout";
export const runtime="nodejs";export const dynamic="force-dynamic";
const respond=(d:unknown,s=200)=>NextResponse.json(d,{status:s,headers:{"Cache-Control":"private, no-store"}});
export async function POST(req:NextRequest){
 const origin=req.headers.get("origin");if(origin&&origin!==req.nextUrl.origin)return respond({error:"Cross-site request rejected"},403);
 let token="";try{const raw=await req.text();if(raw.length>300)return respond({error:"Invalid request"},400);token=(JSON.parse(raw) as {token?:string}).token??""}catch{return respond({error:"Invalid request"},400)}
 if(!/^[a-f0-9]{64}$/.test(token))return respond({error:"Invalid invitation"},400);
 try{
  const {db}=liveServices();
  const {data:gift,error:gerr}=await db.from("complimentary_bookings").select("booking_id,revoked_at").eq("token_hash",createHash("sha256").update(token).digest("hex")).maybeSingle();
  if(gerr||!gift||gift.revoked_at)return respond({error:"Invitation booking unavailable"},404);
  const {data:b,error}=await db.from("bookings")
   .select("id,booking_reference,status,total_cents,confirmation_email_status,events(title,title_en,event_date,event_time,location),booking_guests(guest_index,full_name,category),booking_selections(guest_index,table_label,seat_number)")
   .eq("id",gift.booking_id).eq("event_id",NYE_EVENT_ID).maybeSingle();
  if(error||!b||b.status!=="confirmed"||b.total_cents!==0)return respond({error:"Ticket has not been confirmed"},409);
  const e=b.events as unknown as {title:string;title_en:string|null;event_date:string;event_time:string|null;location:string|null}|null;
  return respond({state:"confirmed",stripePaid:false,complimentary:true,reference:b.booking_reference,paidCents:0,currency:"NZD",
   event:{title:e?.title_en||e?.title||"Yumorilnik",date:e?.event_date??null,time:e?.event_time??null,location:e?.location??null},
   guests:(b.booking_guests??[]).map(g=>({name:g.full_name,category:g.category,seats:(b.booking_selections??[]).filter(s=>s.guest_index===g.guest_index).map(s=>({table:s.table_label,seat:s.seat_number}))})),
   confirmationEmailStatus:b.confirmation_email_status,emailSendingEnabled:process.env.BOOKING_EMAILS_ENABLED==="true",
   matryoshkaUrl:"https://matryoshka.nz/events/novogodnik26?ticket_ref="+encodeURIComponent(b.booking_reference)});
 }catch{return respond({error:"Ticket service temporarily unavailable"},503)}
}