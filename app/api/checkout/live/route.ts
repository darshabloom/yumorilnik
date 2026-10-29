import {NextRequest,NextResponse} from "next/server";
export const runtime="nodejs";
export const dynamic="force-dynamic";
/**
 * Production guard: never route real customers into TEST12 or sandbox checkout.
 * This endpoint stays closed until the live Supabase hold/confirmation RPCs,
 * separate Stripe live account, signed webhook and end-to-end test are deployed.
 */
export async function POST(_request:NextRequest){
 return NextResponse.json({
  error:"Live ticket payment is not yet available. Your card has not been charged.",
  code:"LIVE_CHECKOUT_NOT_READY",
 },{status:503,headers:{"Cache-Control":"no-store"}});
}
