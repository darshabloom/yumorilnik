import {NextResponse} from "next/server";
import {assertYumorilnikStripeAccount,testCheckoutEnabled,testServices} from "@/lib/stripeTestCheckout";

export const runtime="nodejs";
export const dynamic="force-dynamic";

const reply=(ready:boolean,stage:string,status=200)=>
  NextResponse.json({ready,mode:"sandbox",stage,realPaymentsEnabled:false},{
    status,headers:{"Cache-Control":"no-store","X-Robots-Tag":"noindex"},
  });

// Read-only internal preflight for the Vercel-protected Stripe feature preview.
// Never returns keys, database records, tester identities, or customer details.
export async function GET(){
  if(process.env.VERCEL_ENV==="production")return reply(false,"unavailable",404);
  if(!testCheckoutEnabled())return reply(false,"disabled",503);
  if(process.env.NEXT_PUBLIC_REAL_BOOKINGS_ENABLED==="true"||
      process.env.BOOKING_EMAILS_ENABLED==="true")
    return reply(false,"unsafe-flags",503);
  if(!process.env.STRIPE_TEST_WEBHOOK_SECRET?.startsWith("whsec_")||
      (process.env.STRIPE_TEST_ACCESS_CODE?.length??0)<16||
      !(process.env.STRIPE_TEST_ALLOWED_EMAILS??"").trim())
    return reply(false,"missing-test-configuration",503);

  let services:ReturnType<typeof testServices>;
  try{services=testServices()}catch{return reply(false,"credentials",503)}
  try{await assertYumorilnikStripeAccount(services.stripe)}
  catch{return reply(false,"stripe-account",503)}

  try{
    const {error}=await services.db.from("booking_test_checkouts")
      .select("booking_id",{head:true}).limit(1);
    if(error)return reply(false,"database-access",503);
    const promo=await services.db.from("booking_promotions")
      .select("code",{head:true}).limit(1);
    if(promo.error)return reply(false,"promotions-access",503);
  }catch{return reply(false,"database-connectivity",503)}
  return reply(true,"verified");
}
