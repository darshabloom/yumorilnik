import {NextRequest,NextResponse} from "next/server";
import {NYE_EVENT_ID,liveConfigured,liveServices,assertLiveStripeAccount,checkoutSiteOrigin,stripeCall,type StripeLiveSession} from "@/lib/stripeLiveCheckout";
export const runtime="nodejs";export const dynamic="force-dynamic";
const out=(x:unknown,status=200)=>NextResponse.json(x,{status,headers:{"Cache-Control":"no-store"}});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Payload={p_event_id:string;p_client_request_id:string;p_tickets:unknown[];p_guests:unknown[];p_selections:unknown[];p_promo_code?:string|null};
type Hold={booking_id:string;reference:string;amount_cents:number;currency:string;state:string;stripe_session_id?:string|null};
function valid(x:unknown):x is Payload{
 if(!x||typeof x!=="object")return false;
 const p=x as Record<string,unknown>;
 return p.p_event_id===NYE_EVENT_ID&&typeof p.p_client_request_id==="string"&&uuid.test(p.p_client_request_id)&&
  Array.isArray(p.p_tickets)&&p.p_tickets.length>0&&p.p_tickets.length<=20&&
  Array.isArray(p.p_guests)&&p.p_guests.length>0&&p.p_guests.length<=20&&
  Array.isArray(p.p_selections)&&p.p_selections.length<=20&&
  (p.p_promo_code==null||(typeof p.p_promo_code==="string"&&p.p_promo_code.length<=32));
}
function contact(guests:unknown[]){
 for(const entry of guests){if(!entry||typeof entry!=="object")continue;
  const g=entry as Record<string,unknown>;
  if(g.is_child_with_adult_seat!==true&&typeof g.email==="string"&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(g.email))return g.email;
 }return "";
}
function isStripeUrl(url:string|null):url is string{
 if(!url)return false;try{return new URL(url).protocol==="https:"&&new URL(url).hostname==="checkout.stripe.com"}catch{return false}
}
export async function POST(request:NextRequest){
 if(!liveConfigured())return out({error:"Live checkout is not enabled",code:"LIVE_CHECKOUT_NOT_READY"},503);
 let origin:string;try{origin=checkoutSiteOrigin(request)}catch{return out({error:"Unrecognised host"},403)}
 let body:Payload;
 try{const raw=await request.text();if(raw.length>20000)return out({error:"Request too large"},413);const data:unknown=JSON.parse(raw);if(!valid(data))return out({error:"Invalid booking"},400);body=data}
 catch{return out({error:"Invalid JSON"},400)}
 const email=contact(body.p_guests);if(!email)return out({error:"An adult email is required"},400);
 let services:ReturnType<typeof liveServices>;
 try{services=liveServices();await assertLiveStripeAccount(services.stripe,services.account)}
 catch{return out({error:"Live payment configuration is not ready"},503)}
 const {db,stripe}=services;
 // The database is authoritative for seats, discounts and prices.
 const {data,error}=await db.rpc("prepare_live_checkout",{
  p_event_id:body.p_event_id,p_client_request_id:body.p_client_request_id,
  p_tickets:body.p_tickets,p_guests:body.p_guests,p_selections:body.p_selections,
  p_promo_code:body.p_promo_code?.trim().toUpperCase()||null
 });
 if(error||!data)return out({error:"Unable to reserve tickets and seats",code:"RESERVATION_CONFLICT"},409);
 const hold=data as Hold;
 if(hold.currency!=="nzd"||!Number.isSafeInteger(hold.amount_cents)||hold.amount_cents<50)
  return out({error:"Invalid payable total; please contact organiser"},409);
 if(hold.state==="open"&&hold.stripe_session_id){
  try{
   const session=await stripeCall<StripeLiveSession>(stripe,"GET","checkout/sessions/"+encodeURIComponent(hold.stripe_session_id));
   if(session.livemode&&session.status==="open"&&session.client_reference_id===hold.booking_id&&
    session.amount_total===hold.amount_cents&&session.currency==="nzd"&&isStripeUrl(session.url))
    return out({state:"open",url:session.url,reference:hold.reference});
  }catch{}
  return out({error:"Prior payment session is no longer available. Begin a fresh booking."},409);
 }
 if(hold.state!=="creating")return out({error:"Booking cannot be paid in current state"},409);
 const fields=new URLSearchParams();
 fields.set("mode","payment");fields.set("payment_method_types[0]","card");
 fields.set("client_reference_id",hold.booking_id);fields.set("customer_email",email);
 fields.set("line_items[0][price_data][currency]","nzd");
 fields.set("line_items[0][price_data][unit_amount]",String(hold.amount_cents));
 fields.set("line_items[0][price_data][product_data][name]","Yumorilnik admission — "+hold.reference);
 fields.set("line_items[0][quantity]","1");
 fields.set("success_url",origin+"/booking/complete?session_id={CHECKOUT_SESSION_ID}");
 fields.set("cancel_url",origin+"/booking/cancelled");
 fields.set("expires_at",String(Math.floor(Date.now()/1000)+31*60));
 fields.set("metadata[site]","yumorilnik");fields.set("metadata[payment_kind]","event_ticket");
 fields.set("metadata[booking_id]",hold.booking_id);
 fields.set("metadata[event_id]",NYE_EVENT_ID);
 fields.set("metadata[reference]",hold.reference);
 try{
  const session=await stripeCall<StripeLiveSession>(stripe,"POST","checkout/sessions",fields,"yumorilnik-live-"+body.p_client_request_id);
  if(!session.livemode||!session.id.startsWith("cs_live_")||session.status!=="open"||
   session.currency!=="nzd"||session.amount_total!==hold.amount_cents||!isStripeUrl(session.url))
   throw Error("Invalid live Checkout Session");
  const {data:bound,error:bindError}=await db.rpc("bind_live_checkout_session",{
   p_booking_id:hold.booking_id,p_session_id:session.id,p_expires_at:new Date(session.expires_at*1000).toISOString()
  });
  if(bindError||bound!==true){
   try{await stripeCall(stripe,"POST","checkout/sessions/"+encodeURIComponent(session.id)+"/expire",new URLSearchParams())}catch{}
   throw Error("Could not secure checkout seat hold");
  }
  return out({state:"open",url:session.url,reference:hold.reference,amountCents:hold.amount_cents});
 }catch(e){
  console.error("Yumorilnik live session creation failed",e instanceof Error?e.message:"unknown");
  return out({error:"Could not start secured ticket payment"},502);
 }
}
