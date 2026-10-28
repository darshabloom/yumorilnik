import {NextRequest,NextResponse} from "next/server";
import {checkoutSiteOrigin,assertYumorilnikStripeAccount,NYE_EVENT_ID,stripeCall,testCheckoutEnabled,testEmailAllowed,testAccessCodeAllowed,testServices,type StripeTestSession} from "@/lib/stripeTestCheckout";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const json=(value:unknown,status=200)=>NextResponse.json(value,{status,headers:{"Cache-Control":"no-store"}});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type CheckoutPayload={
 p_event_id:string;p_client_request_id:string;
 p_tickets:unknown[];p_guests:unknown[];p_selections:unknown[];p_promo_code?:string;p_test_access_code?:string;
};
type Prepared={
 booking_id:string;reference:string;amount_cents:number;currency:string;
 state:"creating"|"open"|"test_paid";stripe_session_id?:string|null;
};
function isPayload(data:unknown):data is CheckoutPayload{
 if(!data||typeof data!=="object")return false;
 const p=data as Record<string,unknown>;
 return p.p_event_id===NYE_EVENT_ID&&typeof p.p_client_request_id==="string"&&uuid.test(p.p_client_request_id)
  &&Array.isArray(p.p_tickets)&&p.p_tickets.length>0&&p.p_tickets.length<=20
  &&Array.isArray(p.p_guests)&&p.p_guests.length>0&&p.p_guests.length<=20
  &&Array.isArray(p.p_selections)&&p.p_selections.length<=20
  &&(p.p_promo_code===undefined||typeof p.p_promo_code==="string"&&p.p_promo_code.length<=32)
  &&typeof p.p_test_access_code==="string"&&p.p_test_access_code.length<=256;
}
function adultEmail(people:unknown[]){
 for(const person of people){
  if(person&&typeof person==="object"){
   const g=person as Record<string,unknown>;
   if(g.is_child_with_adult_seat!==true&&typeof g.email==="string"&&
       /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(g.email))return g.email;
  }
 }
 return "";
}
function redirectIsStripe(url:string|null):url is string{
 if(!url)return false;
 try{return new URL(url).protocol==="https:"&&new URL(url).hostname==="checkout.stripe.com";}
 catch{return false;}
}
export async function POST(request:NextRequest){
 if(!testCheckoutEnabled())return json({error:"Stripe sandbox checkout is disabled"},503);
 let origin:string;
 try{origin=checkoutSiteOrigin(request)}catch{return json({error:"Unrecognised site origin"},403)}
 let body:CheckoutPayload;
 try{
  const text=await request.text();
  if(text.length>20000)return json({error:"Booking request is too large"},413);
  const data:unknown=JSON.parse(text);
  if(!isPayload(data))return json({error:"Invalid booking request"},400);
  body=data;
 }catch{return json({error:"Invalid request JSON"},400)}
 if(!testAccessCodeAllowed(body.p_test_access_code??""))
  return json({error:"Sandbox access code is incorrect"},403);
 const email=adultEmail(body.p_guests);
 if(!testEmailAllowed(email))return json({error:"This email is not authorised for sandbox checkout"},403);
 let stripe:string;
 let db:ReturnType<typeof testServices>["db"];
 try{({stripe,db}=testServices())}
 catch{return json({error:"Yumorilnik sandbox credentials are not fully configured"},503)}
 try{await assertYumorilnikStripeAccount(stripe)}
 catch{return json({error:"Separate Yumorilnik Stripe test account is not configured"},503)}
 const {data,error}=await db.rpc("prepare_test_checkout",{
  p_event_id:body.p_event_id,p_client_request_id:body.p_client_request_id,
  p_tickets:body.p_tickets,p_guests:body.p_guests,p_selections:body.p_selections,
  p_promo_code:body.p_promo_code?.trim().toUpperCase()||null,
 });
 if(error||!data)return json({error:error?.message?.slice(0,200)||"Unable to prepare booking"},409);
 const hold=data as Prepared;
 if(hold.state==="test_paid")
  return json({state:"test_confirmed",reference:hold.reference,amountCents:0});
 if(!Number.isSafeInteger(hold.amount_cents)||hold.amount_cents<50)
  return json({error:"Amount is below Stripe's minimum transaction amount"},409);
 if(hold.state==="open"&&hold.stripe_session_id){
  try{
   const session=await stripeCall<StripeTestSession>(stripe,"GET","checkout/sessions/"+encodeURIComponent(hold.stripe_session_id));
   if(session.status==="open"&&session.client_reference_id===hold.booking_id&&
      redirectIsStripe(session.url))
    return json({state:"open",url:session.url,reference:hold.reference});
  }catch{return json({error:"Unable to resume existing Stripe Checkout session"},502)}
  return json({error:"Previous Stripe Checkout session is no longer open. Start a new booking."},409);
 }
 if(hold.state!=="creating")return json({error:"Booking is not available for payment"},409);
 const fields=new URLSearchParams();
 fields.set("mode","payment");
 fields.set("allowed_payment_method_types[0]","card");
 fields.set("client_reference_id",hold.booking_id);
 fields.set("customer_email",email);
 fields.set("line_items[0][price_data][currency]","nzd");
 fields.set("line_items[0][price_data][unit_amount]",String(hold.amount_cents));
 fields.set("line_items[0][price_data][product_data][name]","Yumorilnik NYE tickets — "+hold.reference);
 fields.set("line_items[0][quantity]","1");
 fields.set("success_url",origin+"/booking/test/complete?session_id={CHECKOUT_SESSION_ID}");
 fields.set("cancel_url",origin+"/booking/test/cancelled");
 fields.set("expires_at",String(Math.floor(Date.now()/1000)+31*60));
 fields.set("metadata[booking_id]",hold.booking_id);
 fields.set("metadata[event_id]",NYE_EVENT_ID);
 fields.set("metadata[reference]",hold.reference);
 try{
  const session=await stripeCall<StripeTestSession>(
   stripe,"POST","checkout/sessions",fields,"yumorilnik-test-"+body.p_client_request_id);
  if(session.livemode||!session.id.startsWith("cs_test_")||
      session.status!=="open"||!redirectIsStripe(session.url))
   throw new Error("Stripe did not create a safe test Checkout Session");
  const {data:attached,error:attachError}=await db.rpc("bind_test_checkout_session",{
   p_booking_id:hold.booking_id,p_session_id:session.id,
   p_expires_at:new Date(session.expires_at*1000).toISOString(),
  });
  if(attachError||attached!==true){
   // No redirect is handed to the customer if our database failed to attach the hold.
   try{await stripeCall(stripe,"POST","checkout/sessions/"+encodeURIComponent(session.id)+"/expire",new URLSearchParams())}catch{}
   throw new Error("Could not attach Stripe Checkout to your seat hold");
  }
  return json({state:"open",url:session.url,reference:hold.reference,amountCents:hold.amount_cents});
 }catch(e){
  return json({error:(e instanceof Error?e.message:"Unable to start Stripe test checkout").slice(0,180)},502);
 }
}
