import {createHash,randomBytes} from "node:crypto";
import {NextRequest,NextResponse,after} from "next/server";
import {liveServices,NYE_EVENT_ID,checkoutSiteOrigin} from "@/lib/stripeLiveCheckout";
export const runtime="nodejs";export const dynamic="force-dynamic";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{"Cache-Control":"private, no-store"}});
export async function POST(req:NextRequest){
 if(process.env.NEXT_PUBLIC_REAL_BOOKINGS_ENABLED!=="true")return reply({error:"Bookings are not open"},503);
 let origin:string;try{origin=checkoutSiteOrigin(req)}catch{return reply({error:"Unrecognised host"},403)}
 const incomingOrigin=req.headers.get("origin");
 if(incomingOrigin&&incomingOrigin!==origin)return reply({error:"Cross-site request rejected"},403);
 let body:Record<string,unknown>;
 try{const raw=await req.text();if(raw.length>20000)return reply({error:"Request too large"},413);body=JSON.parse(raw)}catch{return reply({error:"Invalid request"},400)}
 if(!body||body.p_event_id!==NYE_EVENT_ID||typeof body.p_client_request_id!=="string"||!uuid.test(body.p_client_request_id)||
  String(body.p_promo_code??"").trim().toUpperCase()!=="FRIENDNY27"||
  body.p_expected_amount_cents!==0||!Array.isArray(body.p_tickets)||!Array.isArray(body.p_guests)||!Array.isArray(body.p_selections)||
  body.p_tickets.length!==1||body.p_guests.length!==1||body.p_selections.length!==1)
  return reply({error:"One adult seat and a valid complimentary code are required"},400);
 const guest=body.p_guests[0] as Record<string,unknown>;
 if(!guest||typeof guest.email!=="string"||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guest.email))
  return reply({error:"A valid adult email is required"},400);
 try{
  const {db}=liveServices();
  const token=randomBytes(32).toString("hex");
  const hash=createHash("sha256").update(token).digest("hex");
  const {data,error}=await db.rpc("confirm_complimentary_booking",{
   p_event_id:body.p_event_id,p_client_request_id:body.p_client_request_id,
   p_tickets:body.p_tickets,p_guests:body.p_guests,
   p_selections:(body.p_selections as Record<string,unknown>[]).map((s,i)=>i===0?{...s,performer_access_code:null}:s),
   p_promo_code:"FRIENDNY27",p_token_hash:hash,p_expected_amount_cents:0
  });
  if(error||data?.state!=="confirmed")return reply({error:"Invitation unavailable or selected seat already reserved",code:"RESERVATION_CONFLICT"},409);
  if(process.env.BOOKING_EMAILS_ENABLED==="true"&&process.env.BOOKING_EMAIL_PROCESSOR_SECRET){
   const bookingId=String(data.booking_id),secret=process.env.BOOKING_EMAIL_PROCESSOR_SECRET;
   after(async()=>{try{await fetch(origin+"/api/internal/send-booking-confirmations",{
    method:"POST",headers:{"Authorization":"Bearer "+secret,"Content-Type":"application/json"},
    body:JSON.stringify({bookingId}),cache:"no-store",signal:AbortSignal.timeout(45000)
   })}catch(e){console.error("Complimentary confirmation dispatch failed",e instanceof Error?e.message:"unknown")}});
  }
  return reply({state:"confirmed",reference:data.reference,url:"/booking/complete?complimentary_token="+token});
 }catch(e){console.error("Complimentary checkout failed",e instanceof Error?e.message:"unknown");return reply({error:"Complimentary checkout temporarily unavailable"},503)}
}