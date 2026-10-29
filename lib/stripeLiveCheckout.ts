import {createClient} from "@supabase/supabase-js";
import {NYE_EVENT_ID,stripeCall,checkoutSiteOrigin,verifyStripeSignature,type StripeTestSession} from "@/lib/stripeTestCheckout";
export {NYE_EVENT_ID,stripeCall,checkoutSiteOrigin,verifyStripeSignature};
export type StripeLiveSession=Omit<StripeTestSession,"metadata">&{
 metadata:({booking_id?:string;event_id?:string;reference?:string;site?:string;payment_kind?:string})|null;
};
const projectRef="vzzabkviwyarrdkevqco";
export function liveConfigured(){
 return process.env.STRIPE_LIVE_CHECKOUT_ENABLED==="true"&&
  (process.env.NEXT_PUBLIC_REAL_BOOKINGS_ENABLED==="true"||
   process.env.LIVE_PAYMENT_TEST_ENABLED==="true");
}
// Webhooks must continue handling already-paid tickets and refunds even after
// the private payment test is closed. This switch never creates charges.
export function liveWebhookConfigured(){
 return process.env.STRIPE_LIVE_WEBHOOK_ENABLED==="true";
}
export function liveServices(){
 const url=process.env.SUPABASE_URL??process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.SUPABASE_SECRET_KEY??process.env.SUPABASE_SERVICE_ROLE_KEY;
 const stripe=process.env.STRIPE_SECRET_KEY;
 // Configure the approved live merchant account ID in Vercel, never a sandbox ID.
 const account=process.env.STRIPE_LIVE_ACCOUNT_ID;
 if(!url||new URL(url).hostname!==projectRef+".supabase.co"||!key||
  !stripe||!(/^(sk|rk)_live_/).test(stripe)||!account?.startsWith("acct_")||
  account==="acct_1UVPo4AcPL3j1y7u"||account==="acct_1SXo5CPIwTIma6Ev")
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
  s.metadata?.booking_id===bookingId&&s.metadata?.event_id===eventId&&
  s.metadata?.site==="yumorilnik"&&s.metadata?.payment_kind==="event_ticket";
}
