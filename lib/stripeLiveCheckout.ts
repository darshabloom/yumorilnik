import {createClient} from "@supabase/supabase-js";
import {NYE_EVENT_ID,stripeCall,checkoutSiteOrigin,verifyStripeSignature,type StripeTestSession} from "@/lib/stripeTestCheckout";
export {NYE_EVENT_ID,stripeCall,checkoutSiteOrigin,verifyStripeSignature};
export type StripeLiveSession=StripeTestSession;
const projectRef="vzzabkviwyarrdkevqco";
export function liveConfigured(){
 return process.env.STRIPE_LIVE_CHECKOUT_ENABLED==="true"&&
  process.env.NEXT_PUBLIC_REAL_BOOKINGS_ENABLED==="true";
}
export function liveServices(){
 const url=process.env.SUPABASE_URL??process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.SUPABASE_SECRET_KEY??process.env.SUPABASE_SERVICE_ROLE_KEY;
 const stripe=process.env.STRIPE_SECRET_KEY;
 const account=process.env.STRIPE_LIVE_ACCOUNT_ID;
 if(!url||new URL(url).hostname!==projectRef+".supabase.co"||!key||
  !stripe?.startsWith("sk_live_")||!account?.startsWith("acct_")||
  account==="acct_1SXo5CPIwTIma6Ev"||account==="acct_1UVPo4AcPL3j1y7u")
  throw new Error("Yumorilnik live credentials unavailable");
 return {db:createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}),stripe,account};
}
export async function assertLiveStripeAccount(stripe:string,expected:string){
 const account=await stripeCall<{id:string}> (stripe,"GET","account");
 if(account.id!==expected)throw new Error("Wrong live Stripe account");
}
export function validateLivePaidSession(s:StripeLiveSession,bookingId:string,eventId:string){
 return s.object==="checkout.session"&&s.livemode===true&&s.id.startsWith("cs_live_")&&
  s.status==="complete"&&s.payment_status==="paid"&&s.currency==="nzd"&&
  Number.isSafeInteger(s.amount_total)&&Number(s.amount_total)>0&&
  !!s.payment_intent?.startsWith("pi_")&&s.client_reference_id===bookingId&&
  s.metadata?.booking_id===bookingId&&s.metadata.event_id===eventId;
}
