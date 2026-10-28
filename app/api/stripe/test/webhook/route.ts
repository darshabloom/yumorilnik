import {NextRequest,NextResponse} from "next/server";
import {NYE_EVENT_ID,assertYumorilnikStripeAccount,stripeCall,testCheckoutEnabled,testServices,validatePaidSession,verifyStripeSignature,type StripeTestSession} from "@/lib/stripeTestCheckout";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{"Cache-Control":"no-store"}});
type StripeEvent={
 id:string;type:string;livemode:boolean;
 data?:{object?:{id?:string;object?:string;metadata?:{booking_id?:string;event_id?:string}}};
};
export async function POST(request:NextRequest){
 if(!testCheckoutEnabled())return reply({error:"Sandbox webhook disabled"},503);
 const secret=process.env.STRIPE_TEST_WEBHOOK_SECRET;
 if(!secret||!secret.startsWith("whsec_"))return reply({error:"Webhook is not configured"},503);
 const raw=await request.text();
 if(raw.length>250000)return reply({error:"Payload too large"},413);
 if(!verifyStripeSignature(raw,request.headers.get("stripe-signature")??"",secret))
  return reply({error:"Invalid Stripe signature"},400);
 let event:StripeEvent;
 try{event=JSON.parse(raw) as StripeEvent}catch{return reply({error:"Invalid event"},400)}
 // Stripe sends other events too. They are always acknowledged but cannot confirm bookings.
 if(!["checkout.session.completed","checkout.session.expired","checkout.session.async_payment_succeeded"].includes(event.type))
  return reply({received:true,ignored:true});
 const sessionObject=event.data?.object;
 if(event.livemode||sessionObject?.object!=="checkout.session"||
    typeof sessionObject.id!=="string"||!sessionObject.id.startsWith("cs_test_"))
  return reply({received:true,ignored:true});
 try{
  const {db,stripe}=testServices();
  await assertYumorilnikStripeAccount(stripe);
  const session=await stripeCall<StripeTestSession>(
   stripe,"GET","checkout/sessions/"+encodeURIComponent(sessionObject.id));
  const bookingId=session.metadata?.booking_id, eventId=session.metadata?.event_id;
  if(!bookingId||eventId!==NYE_EVENT_ID||session.livemode)
   return reply({received:true,ignored:true});
  if(event.type==="checkout.session.expired"){
   if(session.status!=="expired")return reply({received:true,ignored:true});
   const {error}=await db.rpc("expire_test_checkout_session",{
    p_booking_id:bookingId,p_session_id:session.id,
   });
   if(error)throw error;
   return reply({received:true,status:"expired"});
  }
  // Never trust the redirect, event metadata or arbitrary amounts alone:
  // retrieve from Stripe and match our hold amount inside Postgres.
  if(!validatePaidSession(session,bookingId,eventId))
   return reply({received:true,ignored:true});
  const {data,error}=await db.rpc("complete_test_checkout_session",{
   p_booking_id:bookingId,p_session_id:session.id,
   p_intent_id:session.payment_intent,p_amount_cents:session.amount_total,
   p_currency:session.currency,
  });
  if(error)throw error;
  const result=data as {state?:string}|null;
  // "needs_review" means payment was accepted but a seat or promo conflict
  // occurred: do NOT issue or confirm tickets, and do not hide this exception.
  if(result?.state==="needs_review")
   return reply({received:true,status:"needs_review"});
  return reply({received:true,status:result?.state??"processed"});
 }catch(error){
  // A non-2xx response makes Stripe retry delivery.
  // Do not disclose database or Stripe secrets in the public response.
  console.error("Yumorilnik Stripe sandbox webhook processing failed",
   error instanceof Error?error.message:"unknown");
  return reply({error:"Webhook processing is not yet complete"},500);
 }
}
