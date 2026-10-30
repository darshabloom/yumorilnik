import {NextRequest,NextResponse} from "next/server";
import {NYE_EVENT_ID,liveServices,assertLiveStripeAccount,stripeCall,validateLivePaidSession,type StripeLiveSession} from "@/lib/stripeLiveCheckout";
import {createTicketPdf} from "@/lib/ticketPdf";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
const stripeId=/^cs_live_[A-Za-z0-9_]{12,200}$/;
const err=(message:string,status:number)=>NextResponse.json({error:message},{status,headers:{"Cache-Control":"private, no-store"}});

/** Authenticates by the unguessable Stripe success-session token, then verifies
 * Stripe AND the matching immutable paid booking ledger. No auth to unrelated
 * bookings, no tickets for expired, refunded or review-state payments.
 */
export async function POST(req:NextRequest){
 const origin=req.headers.get("origin");
 if(origin&&origin!==req.nextUrl.origin)return err("Cross-site request rejected",403);
 let sessionId="";
 try{
  const raw=await req.text();if(raw.length>500)return err("Invalid request",400);
  const payload=JSON.parse(raw) as {sessionId?:unknown};
  if(typeof payload.sessionId==="string")sessionId=payload.sessionId.trim();
 }catch{return err("Invalid request",400);}
 if(!stripeId.test(sessionId))return err("Invalid checkout session",400);
 try{
  const {db,stripe,account}=liveServices();
  await assertLiveStripeAccount(stripe,account);
  const session=await stripeCall<StripeLiveSession>(stripe,"GET","checkout/sessions/"+encodeURIComponent(sessionId));
  const bookingId=session.metadata?.booking_id??"";
  if(!validateLivePaidSession(session,bookingId,NYE_EVENT_ID)||
    session.id!==sessionId)return err("Verified paid ticket not found",404);
  const {data:hold,error:holdError}=await db.from("booking_live_checkouts")
   .select("state,amount_cents,currency,stripe_session_id,stripe_payment_intent_id")
   .eq("booking_id",bookingId).eq("stripe_session_id",sessionId).maybeSingle();
  if(holdError||!hold||hold.state!=="paid"||hold.currency!=="nzd"||
     Number(hold.amount_cents)!==session.amount_total||
     hold.stripe_payment_intent_id!==session.payment_intent)
   return err("Ticket is not confirmed or has been cancelled or refunded",409);
  const {data,error}=await db.from("bookings")
   .select("id,booking_reference,status,confirmed_at,total_cents,events(title,event_date,event_time,location),booking_guests(guest_index,full_name,category,is_child_with_adult_seat,childcare_hours),booking_selections(guest_index,table_label,seat_number)")
   .eq("id",bookingId).eq("event_id",NYE_EVENT_ID).maybeSingle();
  if(error||!data||data.status!=="confirmed"||
    Number(data.total_cents)!==session.amount_total)return err("Booking not confirmed",409);
  const event=data.events as unknown as {title:string;event_date:string;event_time:string|null;location:string|null}|null;
  if(!event?.title||!event.event_date)return err("Event details incomplete",503);
  const pdf=await createTicketPdf({bookingId:data.id,reference:data.booking_reference,
    event,guests:data.booking_guests??[],seats:data.booking_selections??[],
    isTest:false,issuedAt:data.confirmed_at});
  const filename="yumorilnik-ticket-"+data.booking_reference.replace(/[^A-Z0-9-]/gi,"")+".pdf";
  return new NextResponse(new Uint8Array(pdf),{status:200,headers:{
   "Content-Type":"application/pdf",
   "Content-Disposition":'attachment; filename="'+filename+'"',
   "Content-Length":String(pdf.length),
   "Cache-Control":"private, no-store",
   "X-Content-Type-Options":"nosniff"
  }});
 }catch(e){
  console.error("Verified live ticket PDF download failed",e instanceof Error?e.message:"unknown");
  return err("Could not prepare ticket PDF right now",503);
 }
}
