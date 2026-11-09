import {createHash} from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
import {liveServices,NYE_EVENT_ID} from "@/lib/stripeLiveCheckout";
import {createTicketPdf} from "@/lib/ticketPdf";
export const runtime="nodejs";export const dynamic="force-dynamic";export const maxDuration=60;
const fail=(error:string,status:number)=>NextResponse.json({error},{status,headers:{"Cache-Control":"private, no-store"}});
export async function POST(req:NextRequest){
 const origin=req.headers.get("origin");if(origin&&origin!==req.nextUrl.origin)return fail("Cross-site request rejected",403);
 let token="";try{const raw=await req.text();if(raw.length>300)return fail("Invalid request",400);token=(JSON.parse(raw) as {token?:string}).token??""}catch{return fail("Invalid request",400)}
 if(!/^[a-f0-9]{64}$/.test(token))return fail("Invalid invitation",400);
 try{
  const {db}=liveServices();
  const {data:gift,error:gerr}=await db.from("complimentary_bookings").select("booking_id,revoked_at").eq("token_hash",createHash("sha256").update(token).digest("hex")).maybeSingle();
  if(gerr||!gift||gift.revoked_at)return fail("Ticket unavailable",404);
  const {data:b,error}=await db.from("bookings")
   .select("id,booking_reference,status,total_cents,confirmed_at,events(title,event_date,event_time,location),booking_guests(guest_index,full_name,category,is_child_with_adult_seat,childcare_hours),booking_selections(guest_index,table_label,seat_number)")
   .eq("id",gift.booking_id).eq("event_id",NYE_EVENT_ID).maybeSingle();
  if(error||!b||b.status!=="confirmed"||b.total_cents!==0)return fail("Ticket is not valid",409);
  const event=b.events as unknown as {title:string;event_date:string;event_time:string|null;location:string|null}|null;
  if(!event?.title||!event.event_date)return fail("Incomplete event",503);
  const pdf=await createTicketPdf({bookingId:b.id,reference:b.booking_reference,event,guests:b.booking_guests??[],seats:b.booking_selections??[],isTest:false,issuedAt:b.confirmed_at});
  return new NextResponse(new Uint8Array(pdf),{status:200,headers:{"Content-Type":"application/pdf","Content-Disposition":'attachment; filename="yumorilnik-ticket-'+b.booking_reference.replace(/[^A-Z0-9-]/gi,"")+'.pdf"',"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
 }catch{return fail("Unable to prepare ticket",503)}
}