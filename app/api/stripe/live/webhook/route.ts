import {NextRequest,NextResponse} from "next/server";
import {NYE_EVENT_ID,liveConfigured,liveServices,assertLiveStripeAccount,verifyStripeSignature,stripeCall,validateLivePaidSession,type StripeLiveSession} from "@/lib/stripeLiveCheckout";
export const runtime="nodejs";export const dynamic="force-dynamic";
const out=(x:unknown,status=200)=>NextResponse.json(x,{status,headers:{"Cache-Control":"no-store"}});
type Event={id:string;type:string;livemode:boolean;data?:{object?:{id?:string;object?:string}}};
export async function POST(request:NextRequest){
 if(!liveConfigured())return out({error:"Live webhook not enabled"},503);
 const webhookSecret=process.env.STRIPE_WEBHOOK_SECRET;
 if(!webhookSecret?.startsWith("whsec_"))return out({error:"Webhook not configured"},503);
 const raw=await request.text();if(raw.length>250000)return out({error:"Event too large"},413);
 if(!verifyStripeSignature(raw,request.headers.get("stripe-signature")??"",webhookSecret))
  return out({error:"Invalid signature"},400);
 let event:Event;try{event=JSON.parse(raw) as Event}catch{return out({error:"Invalid event"},400)}
 if(!["checkout.session.completed","checkout.session.async_payment_succeeded","checkout.session.expired"].includes(event.type))
  return out({received:true,ignored:true});
 const object=event.data?.object;
 if(event.livemode!==true||object?.object!=="checkout.session"||!object.id?.startsWith("cs_live_"))
  return out({received:true,ignored:true});
 try{
  const {db,stripe,account}=liveServices();await assertLiveStripeAccount(stripe,account);
  const session=await stripeCall<StripeLiveSession>(stripe,"GET","checkout/sessions/"+encodeURIComponent(object.id));
  const bookingId=session.metadata?.booking_id;
  if(!bookingId||session.metadata?.event_id!==NYE_EVENT_ID||!session.livemode)
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
  // Ticket email delivery will be handled by a verified, idempotent fulfilment worker.
  // Until that worker is deployed, do not claim email delivery.
  return out({received:true,state:"paid"});
 }catch(e){
  console.error("Yumorilnik live webhook processing failed",e instanceof Error?e.message:"unknown");
  return out({error:"Payment confirmation processing incomplete"},500);
 }
}
