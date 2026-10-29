import {after,NextRequest,NextResponse} from "next/server";
import {NYE_EVENT_ID,liveConfigured,liveServices,assertLiveStripeAccount,verifyStripeSignature,stripeCall,validateLivePaidSession,type StripeLiveSession} from "@/lib/stripeLiveCheckout";
export const runtime="nodejs";export const dynamic="force-dynamic";export const maxDuration=60;
const out=(x:unknown,status=200)=>NextResponse.json(x,{status,headers:{"Cache-Control":"no-store"}});
type Event={id:string;type:string;livemode:boolean;data?:{object?:{id?:string;object?:string}}};
type StripeCharge={id:string;object:"charge";livemode:boolean;currency:string;paid:boolean;refunded:boolean;amount:number;amount_refunded:number;payment_intent:string|null};
export async function POST(request:NextRequest){
 if(!liveConfigured())return out({error:"Live webhook not enabled"},503);
 const webhookSecret=process.env.STRIPE_WEBHOOK_SECRET;
 if(!webhookSecret?.startsWith("whsec_"))return out({error:"Webhook not configured"},503);
 const raw=await request.text();if(raw.length>250000)return out({error:"Event too large"},413);
 if(!verifyStripeSignature(raw,request.headers.get("stripe-signature")??"",webhookSecret))
  return out({error:"Invalid signature"},400);
 let event:Event;try{event=JSON.parse(raw) as Event}catch{return out({error:"Invalid event"},400)}
 if(event.type==="charge.refunded"){
  const chargeId=event.data?.object?.id;
  if(event.livemode!==true||event.data?.object?.object!=="charge"||
     !chargeId?.startsWith("ch_live_")&&!chargeId?.startsWith("ch_"))
   return out({received:true,ignored:true});
  try{
   const {db,stripe,account}=liveServices();
   await assertLiveStripeAccount(stripe,account);
   const charge=await stripeCall<StripeCharge>(stripe,"GET","charges/"+encodeURIComponent(chargeId));
   if(charge.object!=="charge"||!charge.livemode||charge.currency!=="nzd"||
      !charge.paid||!charge.payment_intent?.startsWith("pi_")||
      !Number.isSafeInteger(charge.amount)||!Number.isSafeInteger(charge.amount_refunded)||
      charge.amount<50||charge.amount_refunded<1||charge.amount_refunded>charge.amount)
    return out({received:true,ignored:true});
   const {data:hold,error:lookupError}=await db.from("booking_live_checkouts")
    .select("booking_id,state,amount_cents")
    .eq("stripe_payment_intent_id",charge.payment_intent).maybeSingle();
   if(lookupError)throw lookupError;
   // Other charges on the same Stripe account must never affect Yumorilnik seats.
   if(!hold)return out({received:true,ignored:true});
   if(Number(hold.amount_cents)!==charge.amount)throw Error("Refund amount does not match booking ledger");
   if(!charge.refunded||charge.amount_refunded!==charge.amount){
    // Partial refunds do NOT release seats or revoke admission automatically.
    const {error:markError}=await db.from("booking_live_checkouts")
     .update({review_reason:"Partial Stripe refund; organiser review required",updated_at:new Date().toISOString()})
     .eq("booking_id",hold.booking_id).eq("state","paid");
    if(markError)throw markError;
    return out({received:true,state:"partial_refund_review"});
   }
   const {data,error}=await db.rpc("record_verified_full_live_refund",{
    p_booking_id:hold.booking_id,p_payment_intent_id:charge.payment_intent,
    p_charge_id:charge.id,p_charge_amount_cents:charge.amount,
    p_refunded_amount_cents:charge.amount_refunded,p_currency:charge.currency,
   });
   if(error)throw error;
   if((data as {state?:string}|null)?.state!=="refunded")
    throw Error("Full refund state was not recorded");
   return out({received:true,state:"refunded"});
  }catch(e){
   console.error("Yumorilnik refund reconciliation requires retry",e instanceof Error?e.message:"unknown");
   return out({error:"Refund reconciliation incomplete"},500);
  }
 }
 if(!["checkout.session.completed","checkout.session.async_payment_succeeded","checkout.session.expired"].includes(event.type))
  return out({received:true,ignored:true});
 const object=event.data?.object;
 if(event.livemode!==true||object?.object!=="checkout.session"||!object.id?.startsWith("cs_live_"))
  return out({received:true,ignored:true});
 try{
  const {db,stripe,account}=liveServices();await assertLiveStripeAccount(stripe,account);
  const session=await stripeCall<StripeLiveSession>(stripe,"GET","checkout/sessions/"+encodeURIComponent(object.id));
  const bookingId=session.metadata?.booking_id;
  if(!bookingId||session.metadata?.event_id!==NYE_EVENT_ID||
     session.metadata?.site!=="yumorilnik"||session.metadata?.payment_kind!=="event_ticket"||!session.livemode)
   return out({received:true,ignored:true});
  if(event.type==="checkout.session.expired"){
   if(session.status!=="expired")return out({received:true,ignored:true});
   const {error}=await db.rpc("expire_live_checkout_session",{p_booking_id:bookingId,p_session_id:session.id});
   if(error)throw error;
   return out({received:true,state:"expired"});
  }
  if(!validateLivePaidSession(session,bookingId,NYE_EVENT_ID))
   return out({received:true,ignored:true});
  const {data,error}=await db.rpc("complete_live_checkout_session",{
   p_booking_id:bookingId,p_session_id:session.id,p_intent_id:session.payment_intent,
   p_amount_cents:session.amount_total,p_currency:session.currency
  });
  if(error)throw error;
  const state=(data as {state?:string}|null)?.state;
  // Do not issue tickets or notify customers until a confirmed state is committed.
  if(state==="needs_review"){
   console.error("Yumorilnik paid session requires operator review",event.id);
   return out({received:true,state:"needs_review"});
  }
  if(state!=="paid")throw Error("Unexpected live booking state");
  // The paid status has committed. Schedule fulfilment independently of
  // Stripe's webhook acknowledgment: email failures must NOT re-run payment.
  // This is deliberately inert until the organiser enables email sending.
  const secret=process.env.BOOKING_EMAIL_PROCESSOR_SECRET;
  if(process.env.BOOKING_EMAILS_ENABLED==="true"&&secret){
   after(async()=>{
    try{
     const response=await fetch("https://yumorilnik.com/api/internal/send-booking-confirmations",{
      method:"POST",
      headers:{"Authorization":"Bearer "+secret,"Content-Type":"application/json"},
      cache:"no-store",signal:AbortSignal.timeout(45000),
     });
     if(!response.ok)console.error("Paid ticket confirmation worker rejected call",response.status);
    }catch(e){
     console.error("Paid ticket confirmation worker failed",e instanceof Error?e.message:"unknown");
    }
   });
  }
  // Never claim delivery until the dedicated worker has confirmed it.
  return out({received:true,state:"paid"});
 }catch(e){
  console.error("Yumorilnik live webhook processing failed",e instanceof Error?e.message:"unknown");
  return out({error:"Payment confirmation processing incomplete"},500);
 }
}
