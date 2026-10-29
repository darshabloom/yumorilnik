import {NextRequest,NextResponse} from "next/server";
import {timingSafeEqual} from "node:crypto";
import {NYE_EVENT_ID,liveConfigured,liveServices,assertLiveStripeAccount,checkoutSiteOrigin,stripeCall,type StripeLiveSession} from "@/lib/stripeLiveCheckout";
export const runtime="nodejs";export const dynamic="force-dynamic";
const out=(x:unknown,status=200)=>NextResponse.json(x,{status,headers:{"Cache-Control":"no-store"}});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Payload={p_event_id:string;p_client_request_id:string;p_tickets:unknown[];p_guests:unknown[];p_selections:unknown[];p_promo_code?:string|null;p_live_test_access_code?:string};
type Hold={booking_id:string;reference:string;amount_cents:number;currency:string;state:string;stripe_session_id?:string|null};
const PRIVATE_LIVE_TEST_PROMO="YMRLIVE50C2026";
const PRIVATE_LIVE_TEST_AMOUNT_CENTS=50;
function valid(x:unknown):x is Payload{
 if(!x||typeof x!=="object")return false;
 const p=x as Record<string,unknown>;
 return p.p_event_id===NYE_EVENT_ID&&typeof p.p_client_request_id==="string"&&uuid.test(p.p_client_request_id)&&
  Array.isArray(p.p_tickets)&&p.p_tickets.length>0&&p.p_tickets.length<=20&&
  Array.isArray(p.p_guests)&&p.p_guests.length>0&&p.p_guests.length<=20&&
  Array.isArray(p.p_selections)&&p.p_selections.length<=20&&
  (p.p_promo_code==null||(typeof p.p_promo_code==="string"&&p.p_promo_code.length<=32))&&
  (p.p_live_test_access_code==null||(typeof p.p_live_test_access_code==="string"&&p.p_live_test_access_code.length<=256));
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
function isPrivateTestAuthorised(body:Payload,email:string){
 const secret=process.env.LIVE_PAYMENT_TEST_ACCESS_CODE??"";
 const code=body.p_live_test_access_code??"";
 if(secret.length<32||code.length!==secret.length)return false;
 const left=Buffer.from(code,"utf8"),right=Buffer.from(secret,"utf8");
 if(left.length!==right.length||!timingSafeEqual(left,right))return false;
 // Public checkout stays disabled. The private test accepts exactly one
 // standard adult ticket with one named seat and NO promotional code.
 if(body.p_tickets.length!==1||body.p_guests.length!==1||body.p_selections.length!==1||body.p_promo_code)return false;
 const ticket=body.p_tickets[0] as Record<string,unknown>|null;
 const guest=body.p_guests[0] as Record<string,unknown>|null;
 const seat=body.p_selections[0] as Record<string,unknown>|null;
 if(!ticket||ticket.quantity!==1||!guest||guest.is_child_with_adult_seat!==false||
    !seat||seat.guest_index!==0||!Number.isSafeInteger(seat.seat_number)||
    Number(seat.seat_number)<1||typeof seat.table_id!=="string")return false;
 const allowed=(process.env.LIVE_PAYMENT_TEST_ALLOWED_EMAILS??"").split(",")
   .map(value=>value.trim().toLowerCase()).filter(Boolean);
 // A private live checkout never accepts an unconfigured tester allowlist.
 return allowed.length>0&&allowed.includes(email.trim().toLowerCase());
}
// Read-only deployment smoke test. Never returns account IDs, credentials,
// customer records or reservation data; no seats or Stripe payments are created.
export async function GET(){
 if(process.env.VERCEL_ENV!=="production")return out({ready:false,stage:"not-production"},404);
 if(process.env.NEXT_PUBLIC_REAL_BOOKINGS_ENABLED==="true")
  return out({ready:false,stage:"public-bookings-not-isolated"},503);
 if(!process.env.STRIPE_WEBHOOK_SECRET?.startsWith("whsec_"))
  return out({ready:false,stage:"live-webhook-secret"},503);
 let services:ReturnType<typeof liveServices>;
 try{services=liveServices()}catch{return out({ready:false,stage:"live-credentials"},503)}
 let stripeAccount:{id?:string};
 try{stripeAccount=await stripeCall<{id:string}>(services.stripe,"GET","account")}
 catch{return out({ready:false,stage:"stripe-key-rejected-or-missing-account-read"},503)}
 if(stripeAccount.id!==services.account)
  return out({ready:false,stage:"stripe-account-id-mismatch"},503);
 try{
  const {error}=await services.db.from("booking_live_checkouts")
   .select("booking_id",{head:true}).limit(1);
  if(error)return out({ready:false,stage:"database-ledger"},503);
  const {error:eventsError}=await services.db.from("events")
   .select("id",{head:true}).eq("id",NYE_EVENT_ID).limit(1);
  if(eventsError)return out({ready:false,stage:"database-events"},503);
 }catch{return out({ready:false,stage:"database-connectivity"},503)}
 return out({ready:true,mode:"live",publicSalesEnabled:false,stage:"verified",
  privateCheckoutEnabled:liveConfigured()&&process.env.LIVE_PAYMENT_TEST_ENABLED==="true",
  webhookEnabled:process.env.STRIPE_LIVE_WEBHOOK_ENABLED==="true"});
}

export async function POST(request:NextRequest){
 if(!liveConfigured())return out({error:"Live checkout is not enabled",code:"LIVE_CHECKOUT_NOT_READY"},503);
 let origin:string;try{origin=checkoutSiteOrigin(request)}catch{return out({error:"Unrecognised host"},403)}
 let body:Payload;
 try{const raw=await request.text();if(raw.length>20000)return out({error:"Request too large"},413);const data:unknown=JSON.parse(raw);if(!valid(data))return out({error:"Invalid booking"},400);body=data}
 catch{return out({error:"Invalid JSON"},400)}
 const email=contact(body.p_guests);if(!email)return out({error:"An adult email is required"},400);
 const privateTest=process.env.NEXT_PUBLIC_REAL_BOOKINGS_ENABLED!=="true";
 if(privateTest){
  if(process.env.LIVE_PAYMENT_TEST_ENABLED!=="true"||!isPrivateTestAuthorised(body,email))
   return out({error:"Private live payment test is unavailable or not authorised"},403);
 }
 let services:ReturnType<typeof liveServices>;
 try{services=liveServices();await assertLiveStripeAccount(services.stripe,services.account)}
 catch{return out({error:"Live payment configuration is not ready"},503)}
 const {db,stripe}=services;
 if(privateTest){
  // Read the DB-authoritative one-use promotion before reserving any seats.
  // Never create a ticket or charge at the ordinary price during this test.
  const promoFields="enabled,discount_type,amount_cents,event_id,applies_to,max_uses,times_used,starts_at,ends_at";
  let {data:promo,error:promoError}=await db.from("booking_promotions")
   .select(promoFields).eq("code",PRIVATE_LIVE_TEST_PROMO).maybeSingle();
  // Provision exactly ONE temporary server-controlled promotion on first
  // authorised test, without changing the actual ticket or seat prices.
  // It expires automatically and cannot be reused after one paid redemption.
  if(!promo&&!promoError){
   const {error:seedError}=await db.from("booking_promotions").insert({
    code:PRIVATE_LIVE_TEST_PROMO,enabled:true,discount_type:"fixed_price",
    percent_off:0,amount_cents:PRIVATE_LIVE_TEST_AMOUNT_CENTS,
    event_id:NYE_EVENT_ID,max_uses:1,applies_to:"adult",
    ticket_type_ids:[],starts_at:new Date().toISOString(),
    ends_at:new Date(Date.now()+24*60*60*1000).toISOString(),
    min_tickets:1,internal_note:"Single-use NZ$0.50 live ticket checkout verification. Refund after test. Not for public sale."
   });
   if(seedError){
    // Race-safe: only use an existing promotion that passes ALL checks below.
    console.warn("Private 50-cent promo not created",seedError.code??"unknown");
   }
   const current=await db.from("booking_promotions")
    .select(promoFields).eq("code",PRIVATE_LIVE_TEST_PROMO).maybeSingle();
   promo=current.data;promoError=current.error;
  }
  const now=Date.now();
  if(promoError||!promo||promo.enabled!==true||
     promo.discount_type!=="fixed_price"||promo.amount_cents!==PRIVATE_LIVE_TEST_AMOUNT_CENTS||
     promo.event_id!==NYE_EVENT_ID||promo.applies_to!=="adult"||
     promo.max_uses!==1||promo.times_used!==0||
     (promo.starts_at&&Date.parse(promo.starts_at)>now)||
     (promo.ends_at&&Date.parse(promo.ends_at)<=now))
   return out({error:"The NZ$0.50 private test discount is not configured yet. No booking or charge was created."},503);
  const ticket=body.p_tickets[0] as {ticket_type_id?:string};
  if(!ticket.ticket_type_id||!uuid.test(ticket.ticket_type_id))
   return out({error:"Adult test ticket required"},400);
  const {data:adult,error:adultError}=await db.from("ticket_types")
   .select("name").eq("id",ticket.ticket_type_id).eq("event_id",NYE_EVENT_ID)
   .eq("is_active",true).maybeSingle();
  if(adultError||!adult||!/adult|взросл/i.test(adult.name))
   return out({error:"Only one adult ticket may be purchased in the live test"},403);
 }
 // The database is authoritative for seats, discounts and prices.
 const {data,error}=await db.rpc("prepare_live_checkout",{
  p_event_id:body.p_event_id,p_client_request_id:body.p_client_request_id,
  p_tickets:body.p_tickets,p_guests:body.p_guests,p_selections:body.p_selections,
  p_promo_code:privateTest?PRIVATE_LIVE_TEST_PROMO:body.p_promo_code?.trim().toUpperCase()||null
 });
 if(error||!data)return out({error:"Unable to reserve tickets and seats",code:"RESERVATION_CONFLICT"},409);
 const hold=data as Hold;
 // A failed promotion must NEVER redirect to a full-price Stripe checkout.
 if(privateTest&&hold.amount_cents!==PRIVATE_LIVE_TEST_AMOUNT_CENTS)
  return out({error:"Private test must cost exactly NZ$0.50. No payment was initiated."},503);
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
 if(privateTest)fields.set("metadata[live_test]","50_cent_controlled_test");
 // Stripe Dashboard charge and PaymentIntent reporting must retain the site
 // identity as well as the Checkout Session metadata.
 fields.set("payment_intent_data[metadata][site]","yumorilnik");
 fields.set("payment_intent_data[metadata][payment_kind]","event_ticket");
 fields.set("payment_intent_data[metadata][booking_id]",hold.booking_id);
 fields.set("payment_intent_data[metadata][event_id]",NYE_EVENT_ID);
 if(privateTest)fields.set("payment_intent_data[metadata][live_test]","50_cent_controlled_test");
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
