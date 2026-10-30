import {after,NextRequest,NextResponse} from "next/server";
import {NYE_EVENT_ID,liveServices,assertLiveStripeAccount,stripeCall,validateLivePaidSession,type StripeLiveSession} from "@/lib/stripeLiveCheckout";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{"Cache-Control":"no-store, private"}});
const stripeId=/^cs_live_[A-Za-z0-9_]{12,200}$/;
type Seat={guest_index:number|null;table_label:string;seat_number:number|null};
type Guest={guest_index:number;full_name:string;category:string};
type Booking={id:string;booking_reference:string;status:string;total_cents:number|null;confirmation_email_status:string|null;
 events:{title:string;title_en:string|null;event_date:string|null;event_time:string|null;location:string|null}|null;
 booking_guests:Guest[];booking_selections:Seat[]};

/**
 * The Stripe success URL contains an unguessable session identifier.
 * We independently fetch that live Stripe session and match it against
 * the immutable Yumorilnik booking ledger before returning any details.
 *
 * This POST is also an idempotent recovery path when a signed webhook
 * arrives late: only a genuinely PAID and fully validated Stripe session
 * can trigger the existing transaction-safe confirmation RPC.
 */
export async function POST(request:NextRequest){
 const origin=request.headers.get("origin");
 if(origin&&origin!==request.nextUrl.origin)return json({error:"Cross-site request rejected"},403);
 let id="";
 try{
  const input=await request.json() as {sessionId?:unknown};
  if(typeof input.sessionId==="string")id=input.sessionId.trim();
 }catch{return json({error:"Invalid request"},400);}
 if(!stripeId.test(id))return json({error:"Invalid Stripe session"},400);
 try{
  const {db,stripe,account}=liveServices();
  await assertLiveStripeAccount(stripe,account);
  const session=await stripeCall<StripeLiveSession>(stripe,"GET","checkout/sessions/"+encodeURIComponent(id));
  const bookingId=session.metadata?.booking_id;
  if(!bookingId||session.metadata?.event_id!==NYE_EVENT_ID||
     session.metadata.site!=="yumorilnik"||session.metadata.payment_kind!=="event_ticket"||
     session.livemode!==true||session.client_reference_id!==bookingId||session.id!==id)
   return json({error:"This is not a Yumorilnik ticket checkout"},404);

  const {data:hold,error:holdError}=await db.from("booking_live_checkouts")
   .select("booking_id,state,stripe_session_id,amount_cents,currency")
   .eq("booking_id",bookingId).eq("stripe_session_id",id).maybeSingle();
  if(holdError||!hold)return json({error:"Booking verification unavailable"},503);
  if(session.currency!=="nzd"||session.amount_total!==Number(hold.amount_cents))
   return json({state:"needs_review",message:"The payment amount needs organiser review"},200);

  const verifiedPaid=validateLivePaidSession(session,bookingId,NYE_EVENT_ID);
  let state=String(hold.state);
  if(verifiedPaid&&state!=="paid"&&state!=="needs_review"&&state!=="refunded"){
   // Same idempotent DB RPC as the verified Stripe webhook. Never mark a
   // ticket paid just because a browser landed on the success page.
   const {data,error}=await db.rpc("complete_live_checkout_session",{
    p_booking_id:bookingId,p_session_id:id,p_intent_id:session.payment_intent,
    p_amount_cents:session.amount_total,p_currency:session.currency
   });
   if(error){
    console.error("Live Stripe return reconciliation requires operator review",error.message);
    return json({state:"processing",stripePaid:true,message:"Payment received; confirmation is being checked"});
   }
   state=String((data as {state?:string}|null)?.state??"processing");
  }
  if(!verifiedPaid)return json({state:state==="needs_review"?"needs_review":"processing",stripePaid:session.payment_status==="paid",
   message:"Payment verification is still in progress"});
  if(state!=="paid")return json({state:state==="refunded"?"refunded":state==="needs_review"?"needs_review":"processing",stripePaid:true,
   message:"Payment was received but the booking requires verification before tickets can be issued"});

  const {data:row,error}=await db.from("bookings")
   .select("id,booking_reference,status,total_cents,confirmation_email_status,events(title,title_en,event_date,event_time,location),booking_guests(guest_index,full_name,category),booking_selections(guest_index,table_label,seat_number)")
   .eq("id",bookingId).eq("event_id",NYE_EVENT_ID).maybeSingle();
  if(error||!row)return json({state:"processing",stripePaid:true,message:"The paid booking details are not ready yet"});
  const booking=row as unknown as Booking;
  if(booking.status!=="confirmed"||Number(booking.total_cents)!==Number(hold.amount_cents))
   return json({state:"needs_review",stripePaid:true,message:"Your payment needs booking verification"});
  // Trigger an idempotent fulfilment attempt for this paid booking even if
  // the original Stripe webhook arrived before email delivery was enabled.
  if(process.env.BOOKING_EMAILS_ENABLED==="true"&&
     booking.confirmation_email_status!=="sent"&&
     process.env.BOOKING_EMAIL_PROCESSOR_SECRET){
   const processorSecret=process.env.BOOKING_EMAIL_PROCESSOR_SECRET;
   after(async()=>{
    try{
     const res=await fetch("https://www.yumorilnik.com/api/internal/send-booking-confirmations",{
      method:"POST",headers:{"Authorization":"Bearer "+processorSecret,
       "Content-Type":"application/json"},
      body:JSON.stringify({bookingId}),cache:"no-store",signal:AbortSignal.timeout(45000)
     });
     if(!res.ok)console.error("Booking email worker returned HTTP",res.status);
    }catch(e){console.error("Booking email worker unavailable",e instanceof Error?e.message:"unknown");}
   });
  }
  // Do not expose purchaser email or other unrelated bookings.
  const guests=(booking.booking_guests??[]).map(g=>({name:g.full_name,category:g.category,
   seats:(booking.booking_selections??[]).filter(s=>s.guest_index===g.guest_index)
    .map(s=>({table:s.table_label,seat:s.seat_number}))}));
  return json({state:"confirmed",stripePaid:true,reference:booking.booking_reference,
   paidCents:booking.total_cents,currency:"NZD",
   event:{title:booking.events?.title_en||booking.events?.title||"Yumorilnik event",
    date:booking.events?.event_date||null,time:booking.events?.event_time||null,
    location:booking.events?.location||null},
   guests,
   confirmationEmailStatus:booking.confirmation_email_status??"pending",
   emailSendingEnabled:process.env.BOOKING_EMAILS_ENABLED==="true",
   matryoshkaUrl:"https://matryoshka.nz/events/novogodnik26?ticket_ref="+
    encodeURIComponent(booking.booking_reference)});
 }catch(e){
  console.error("Live ticket status lookup failed",e instanceof Error?e.message:"unknown");
  return json({error:"Unable to verify booking at present. Keep your Stripe receipt and do not pay again."},503);
 }
}
