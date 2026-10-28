import {timingSafeEqual} from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
import {NYE_EVENT_ID,assertYumorilnikStripeAccount,stripeCall,testCheckoutEnabled,testServices,validatePaidSession,type StripeTestSession} from "@/lib/stripeTestCheckout";
export const runtime="nodejs";
export const dynamic="force-dynamic";
function same(a:string,b:string){
 const x=Buffer.from(a),y=Buffer.from(b);
 return x.length===y.length&&timingSafeEqual(x,y);
}
const json=(x:unknown,status=200)=>NextResponse.json(x,{status,headers:{"Cache-Control":"no-store"}});
type Hold={booking_id:string;stripe_session_id:string|null;state:string;expires_at:string;created_at:string};
export async function POST(request:NextRequest){
 const secret=process.env.STRIPE_TEST_RECONCILE_SECRET;
 if(!secret||!same(request.headers.get("authorization")??"","Bearer "+secret))
  return json({error:"Unauthorised"},401);
 if(!testCheckoutEnabled())return json({error:"Sandbox disabled"},503);
 let db:ReturnType<typeof testServices>["db"],stripe:string;
 try{({db,stripe}=testServices())}
 catch{return json({error:"Sandbox credentials not configured"},503)}
 try{await assertYumorilnikStripeAccount(stripe)}
 catch{return json({error:"Separate Yumorilnik Stripe test account is not configured"},503)}
 const {data,error}=await db.from("booking_test_checkouts")
  .select("booking_id,stripe_session_id,state,expires_at,created_at")
  .eq("event_id",NYE_EVENT_ID).in("state",["creating","open"])
  .lt("expires_at",new Date().toISOString())
  .order("expires_at",{ascending:true}).limit(30);
 if(error)return json({error:"Cannot list sandbox holds"},502);
 let expired=0,paid=0,review=0,failed=0;
 for(const row of (data??[]) as Hold[]){
  try{
   if(row.state==="creating"&&!row.stripe_session_id){
    // Requires 90-minute grace; atomic SQL function makes the decision.
    const {data:ok,error:e}=await db.rpc("abandon_unbound_test_checkout",{p_booking_id:row.booking_id});
    if(e)throw e;
    if(ok===true)expired++;
    continue;
   }
   if(!row.stripe_session_id)continue;
   let session=await stripeCall<StripeTestSession>(
    stripe,"GET","checkout/sessions/"+encodeURIComponent(row.stripe_session_id));
   if(session.livemode||session.metadata?.booking_id!==row.booking_id||
      session.metadata?.event_id!==NYE_EVENT_ID)throw new Error("Unexpected checkout session");
   if(session.status==="open"){
    // Stripe itself must expire the session before the DB releases a seat hold.
    await stripeCall(stripe,"POST",
      "checkout/sessions/"+encodeURIComponent(session.id)+"/expire",new URLSearchParams());
    session=await stripeCall<StripeTestSession>(
      stripe,"GET","checkout/sessions/"+encodeURIComponent(session.id));
   }
   if(session.status==="expired"){
    const {data:ok,error:e}=await db.rpc("expire_test_checkout_session",{
     p_booking_id:row.booking_id,p_session_id:session.id,
    });
    if(e)throw e;
    if(ok===true)expired++;
   }else if(validatePaidSession(session,row.booking_id,NYE_EVENT_ID)){
    const {data:result,error:e}=await db.rpc("complete_test_checkout_session",{
     p_booking_id:row.booking_id,p_session_id:session.id,
     p_intent_id:session.payment_intent,p_amount_cents:session.amount_total,
     p_currency:session.currency,
    });
    if(e)throw e;
    if((result as {state?:string}|null)?.state==="test_paid")paid++;
    else review++;
   }else review++;
  }catch(error){
   console.error("Sandbox reconciliation failed for one hold",
    row.booking_id,error instanceof Error?error.message:"unknown");
   failed++;
  }
 }
 return json({examined:(data??[]).length,expired,paid,review,failed});
}
