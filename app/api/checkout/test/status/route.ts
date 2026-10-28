import {NextRequest,NextResponse} from "next/server";
import {NYE_EVENT_ID,stripeCall,testCheckoutEnabled,testServices,type StripeTestSession} from "@/lib/stripeTestCheckout";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const json=(x:unknown,status=200)=>NextResponse.json(x,{status,headers:{"Cache-Control":"no-store"}});
export async function GET(request:NextRequest){
 if(!testCheckoutEnabled())return json({error:"Sandbox checkout disabled"},503);
 const id=request.nextUrl.searchParams.get("session_id")??"";
 if(!/^cs_test_[a-zA-Z0-9_]{12,200}$/.test(id))
  return json({error:"Invalid sandbox session ID"},400);
 try{
  const {db,stripe}=testServices();
  const session=await stripeCall<StripeTestSession>(stripe,"GET","checkout/sessions/"+encodeURIComponent(id));
  const bookingId=session.metadata?.booking_id;
  if(session.livemode||!bookingId||session.metadata?.event_id!==NYE_EVENT_ID||
     session.client_reference_id!==bookingId)
   return json({error:"Unknown Yumorilnik sandbox session"},404);
  if(session.status==="expired"){
   // Only Stripe's verified expired status permits releasing a seat hold.
   const {error}=await db.rpc("expire_test_checkout_session",{
    p_booking_id:bookingId,p_session_id:id,
   });
   if(error)throw error;
  }
  const {data,error}=await db.from("booking_test_checkouts")
   .select("state,stripe_session_id,booking_id,bookings(booking_reference,status)")
   .eq("booking_id",bookingId).eq("stripe_session_id",id).maybeSingle();
  if(error||!data)return json({error:"Sandbox booking was not found"},404);
  const row=data as unknown as {
   state:string;bookings:{booking_reference:string;status:string}|null;
  };
  return json({
   state:row.state,
   reference:row.bookings?.booking_reference??null,
   paymentStatus:session.payment_status,
   sessionStatus:session.status,
   isRealTicket:false,
  });
 }catch(e){
  console.error("Stripe sandbox status lookup failed",e instanceof Error?e.message:"unknown");
  return json({error:"Unable to verify payment status"},502);
 }
}
