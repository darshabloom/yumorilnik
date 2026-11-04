import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"no-store"}});
async function admin(request:NextRequest){
 const token=request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 const secret=process.env.SUPABASE_SECRET_KEY??process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!token||!url||!anon||!secret)return null;
 const auth=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error}=await auth.auth.getUser(token);
 if(error||!user)return null;
 const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:role}=await db.from("admin_users").select("role").eq("user_id",user.id).maybeSingle();
 return role&&["owner","admin"].includes(role.role)?db:null;
}
export async function GET(request:NextRequest){
 const db=await admin(request);
 if(!db)return json({error:"Organiser access required"},403);
 const {data:rows,error}=await db.from("booking_confirmation_deliveries")
 .select("booking_id,guest_index,recipient_email,status,attempts,provider_message_id,error_message,last_attempt_at,sent_at,bookings(booking_reference,status,created_at,events(title,title_en))")
 .order("last_attempt_at",{ascending:false,nullsFirst:false}).limit(300);
 if(error)return json({error:"Unable to load email history: "+error.message},502);
 const records=(rows??[]).map(row=>({
  ...row,
  type:"Booking confirmation",
  // A Resend API acceptance is not proof of inbox delivery.
  delivery_status:row.status==="sent"?"accepted_by_provider":row.status
 }));
 return json({records});
}
export async function POST(request:NextRequest){
 const origin=request.headers.get("origin");
 if(origin&&origin!==new URL(request.url).origin)return json({error:"Invalid origin"},403);
 const db=await admin(request);
 if(!db)return json({error:"Organiser access required"},403);
 let bookingId="",guestIndex=-1;
 try{
  const body=await request.json() as {bookingId?:unknown;guestIndex?:unknown};
  if(typeof body.bookingId==="string")bookingId=body.bookingId;
  if(typeof body.guestIndex==="number")guestIndex=body.guestIndex;
 }catch{return json({error:"Invalid request"},400)}
 if(!/^[a-f0-9-]{36}$/i.test(bookingId)||!Number.isInteger(guestIndex)||guestIndex< -1)return json({error:"Invalid recipient"},400);
 const {data:entry,error}=await db.from("booking_confirmation_deliveries")
 .select("status,attempts,provider_message_id,recipient_email")
 .eq("booking_id",bookingId).eq("guest_index",guestIndex).maybeSingle();
 if(error||!entry)return json({error:"Email record not found"},404);
 if(entry.status!=="failed"||entry.provider_message_id||entry.attempts>=3)
  return json({error:"Only failed, unaccepted messages with attempts remaining can be retried"},409);
 // Read the production payment ledger before invoking the existing guarded worker.
 const {data:paid}=await db.from("booking_live_checkouts")
 .select("state,currency,stripe_session_id,stripe_payment_intent_id").eq("booking_id",bookingId).maybeSingle();
 if(!paid||paid.state!=="paid"||paid.currency!=="nzd"||
   !paid.stripe_session_id?.startsWith("cs_live_")||!paid.stripe_payment_intent_id?.startsWith("pi_"))
  return json({error:"A verified paid live booking is required"},409);
 if(process.env.BOOKING_EMAILS_ENABLED!=="true"||!process.env.BOOKING_EMAIL_PROCESSOR_SECRET)
  return json({error:"Live email processing is disabled"},503);
 const result=await fetch(new URL("/api/internal/send-booking-confirmations",request.url),{
  method:"POST",headers:{"Authorization":"Bearer "+process.env.BOOKING_EMAIL_PROCESSOR_SECRET,
   "Content-Type":"application/json"},body:JSON.stringify({bookingId}),cache:"no-store"
 });
 const outcome=await result.json().catch(()=>({}));
 if(!result.ok)return json({error:"Retry processor unavailable",detail:outcome},502);
 const {data:updated}=await db.from("booking_confirmation_deliveries")
 .select("status,provider_message_id,error_message").eq("booking_id",bookingId).eq("guest_index",guestIndex).maybeSingle();
 return json({ok:updated?.status==="sent",status:updated?.status??"unknown",
  message:updated?.status==="sent"?"Resend accepted the retry":"Retry processed; review current status"});
}
