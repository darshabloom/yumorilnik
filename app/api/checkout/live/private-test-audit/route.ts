import {timingSafeEqual} from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
import {NYE_EVENT_ID,liveServices,assertLiveStripeAccount,stripeCall,validateLivePaidSession,type StripeLiveSession} from "@/lib/stripeLiveCheckout";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{"Cache-Control":"no-store, private"}});
/**
 * Temporary private live 50c payment audit. Requires the test access code;
 * returns only state, delivery status and the user's own booking reference.
 * Never returns secrets, customer email, seat holds or Stripe identifiers.
 */
export async function POST(req:NextRequest){
 const configured=process.env.LIVE_PAYMENT_TEST_ACCESS_CODE??"";
 const origin=req.headers.get("origin");
 if(origin&&origin!==req.nextUrl.origin)return reply({error:"Origin rejected"},403);
 let code="";
 try{const body=await req.text();if(body.length>250)return reply({error:"Invalid request"},400);
  const json=JSON.parse(body) as {code?:unknown};if(typeof json.code==="string")code=json.code;}catch{return reply({error:"Invalid request"},400)}
 const a=Buffer.from(code),b=Buffer.from(configured);
 if(configured.length<32||a.length!==b.length||!timingSafeEqual(a,b))return reply({error:"Unauthorised"},403);
 try{
  const {db,stripe,account}=liveServices();
  await assertLiveStripeAccount(stripe,account);
  const {data:rows,error}=await db.from("booking_live_checkouts")
   .select("booking_id,state,stripe_session_id,amount_cents,currency")
   .eq("event_id",NYE_EVENT_ID).eq("promotion_code","YMRLIVE50C2026")
   .eq("amount_cents",50).order("created_at",{ascending:false}).limit(2);
  if(error)throw error;
  if(!rows?.length)return reply({found:false});
  const item=rows[0],id=item.stripe_session_id;
  if(!id)return reply({found:true,ledgerState:item.state,sessionBound:false});
  const session=await stripeCall<StripeLiveSession>(stripe,"GET","checkout/sessions/"+encodeURIComponent(id));
  const verifiedPaid=validateLivePaidSession(session,item.booking_id,NYE_EVENT_ID);
  let state=item.state;
  if(verifiedPaid&&state==="open"){
   const {data:result,error:completeError}=await db.rpc("complete_live_checkout_session",{
    p_booking_id:item.booking_id,p_session_id:session.id,p_intent_id:session.payment_intent,
    p_amount_cents:session.amount_total,p_currency:session.currency
   });
   if(completeError)throw completeError;
   state=(result as {state?:string}|null)?.state??state;
  }
  const {data:booking,error:bookingError}=await db.from("bookings")
   .select("status,booking_reference,confirmation_email_status")
   .eq("id",item.booking_id).maybeSingle();
  if(bookingError)throw bookingError;
  const {data:deliveries,error:deliveryError}=await db.from("booking_confirmation_deliveries")
   .select("status").eq("booking_id",item.booking_id);
  if(deliveryError)throw deliveryError;
  return reply({found:true,stripePaid:verifiedPaid,ledgerState:state,
   bookingConfirmed:booking?.status==="confirmed",
   reference:booking?.status==="confirmed"?booking.booking_reference:null,
   emailStatus:booking?.confirmation_email_status??null,
   deliveryStates:(deliveries??[]).map(x=>x.status),
   emailSendingEnabled:process.env.BOOKING_EMAILS_ENABLED==="true",
   recentTestRecords:rows.length});
 }catch(e){console.error("Private live test audit failed",e instanceof Error?e.message:"unknown");
  return reply({error:"Private live payment check unavailable"},503);}
}
