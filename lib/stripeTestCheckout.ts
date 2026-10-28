import {createClient} from "@supabase/supabase-js";
import {createHmac,timingSafeEqual} from "node:crypto";

export const NYE_EVENT_ID="3f6fa4d1-aaca-4326-9c01-5774cffca2f5";
const YUMORILNIK_REF="vzzabkviwyarrdkevqco";

export type StripeTestSession={
 id:string;object:"checkout.session";url:string|null;expires_at:number;
 status:"open"|"complete"|"expired";
 payment_status:"paid"|"unpaid"|"no_payment_required";
 amount_total:number|null;currency:string|null;livemode:boolean;
 client_reference_id:string|null;
 payment_intent:string|null;
 metadata:{booking_id?:string;event_id?:string;reference?:string}|null;
};

export function testCheckoutEnabled(){
 return process.env.STRIPE_TEST_CHECKOUT_ENABLED==="true";
}
export function testServices(){
 const url=process.env.SUPABASE_URL??process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.SUPABASE_SECRET_KEY??process.env.SUPABASE_SERVICE_ROLE_KEY;
 const stripe=process.env.STRIPE_TEST_SECRET_KEY;
 if(!url||new URL(url).hostname!==YUMORILNIK_REF+".supabase.co")
  throw new Error("Yumorilnik Supabase URL is missing or does not match the correct project");
 if(!key)throw new Error("Supabase server secret is not configured");
 if(!stripe||!stripe.startsWith("sk_test_"))throw new Error("Yumorilnik Stripe test secret is not configured");
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 return {db,stripe};
}
export function testEmailAllowed(email:string){
 const entries=(process.env.STRIPE_TEST_ALLOWED_EMAILS??"")
   .split(",").map(s=>s.trim().toLowerCase()).filter(Boolean);
 return entries.length>0&&entries.includes(email.trim().toLowerCase());
}
export async function assertYumorilnikStripeAccount(secret:string){
 const expected=process.env.STRIPE_TEST_ACCOUNT_ID;
 if(!expected||!/^acct_[A-Za-z0-9]+$/.test(expected)||
   expected==="acct_1SXo5CPIwTIma6Ev")
  throw new Error("A separate Yumorilnik Stripe test account is required");
 const account=await stripeCall<{id:string;livemode?:boolean}>(secret,"GET","account");
 if(account.id!==expected||account.id==="acct_1SXo5CPIwTIma6Ev")
  throw new Error("Stripe account does not belong to Yumorilnik sandbox");
}
export function testAccessCodeAllowed(candidate:string){
 const secret=process.env.STRIPE_TEST_ACCESS_CODE??"";
 if(secret.length<16||candidate.length!==secret.length)return false;
 const lhs=Buffer.from(candidate,"utf8"),rhs=Buffer.from(secret,"utf8");
 return lhs.length===rhs.length&&timingSafeEqual(lhs,rhs);
}
export function checkoutSiteOrigin(request:Request){
 const origin=new URL(request.url).origin;
 const hostname=new URL(origin).hostname;
 // No redirects to arbitrary Host headers supplied by strangers.
 const allowed=["yumorilnik.com","www.yumorilnik.com","yumorilnik.vercel.app"];
 if(!allowed.includes(hostname)&&
    !/^yumorilnik-[a-z0-9-]+-darsha-waterhouses-projects\.vercel\.app$/.test(hostname)&&
    !["localhost","127.0.0.1"].includes(hostname))
  throw new Error("Unrecognised checkout host");
 const browserOrigin=request.headers.get("origin");
 if(browserOrigin&&browserOrigin!==origin)
  throw new Error("Cross-origin checkout request blocked");
 return origin;
}
export async function stripeCall<T>(
 secret:string,method:"GET"|"POST",path:string,
 fields?:URLSearchParams,idempotencyKey?:string
):Promise<T>{
 const response=await fetch("https://api.stripe.com/v1/"+path,{
  method,
  headers:{
   Authorization:"Bearer "+secret,
   ...(fields?{"Content-Type":"application/x-www-form-urlencoded"}:{}),
   ...(idempotencyKey?{"Idempotency-Key":idempotencyKey}:{}),
  },
  ...(fields?{body:fields.toString()}:{}),
  cache:"no-store",
 });
 const data=await response.json() as T&{error?:{message?:string;type?:string}};
 if(!response.ok||data.error){
  const message=(data.error?.message??"Stripe request failed").slice(0,160);
  throw new Error(message);
 }
 return data;
}
export function verifyStripeSignature(raw:string,header:string,secret:string){
 if(!secret.startsWith("whsec_")||!header)return false;
 const parts=header.split(",").map(x=>x.trim());
 const t=parts.find(s=>s.startsWith("t="))?.slice(2);
 const versions=parts.filter(s=>s.startsWith("v1=")).map(s=>s.slice(3));
 if(!t||! /^\d+$/.test(t)||versions.length===0)return false;
 const timestamp=Number(t);
 if(!Number.isSafeInteger(timestamp)||Math.abs(Date.now()/1000-timestamp)>300)return false;
 const expected=createHmac("sha256",secret).update(t+"."+raw,"utf8").digest("hex");
 const a=Buffer.from(expected,"hex");
 return versions.some(v=>{
  if(!/^[a-f0-9]{64}$/i.test(v))return false;
  const b=Buffer.from(v,"hex");
  return a.length===b.length&&timingSafeEqual(a,b);
 });
}
export function validatePaidSession(session:StripeTestSession,bookingId:string,eventId:string){
 return session.object==="checkout.session"&&!session.livemode&&
  session.id.startsWith("cs_test_")&&session.status==="complete"&&
  session.payment_status==="paid"&&session.currency==="nzd"&&
  Number.isSafeInteger(session.amount_total)&&Number(session.amount_total)>0&&
  typeof session.payment_intent==="string"&&session.payment_intent.startsWith("pi_")&&
  session.client_reference_id===bookingId&&
  session.metadata?.booking_id===bookingId&&session.metadata?.event_id===eventId;
}
