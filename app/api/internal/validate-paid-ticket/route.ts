import {timingSafeEqual} from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {NYE_EVENT_ID} from "@/lib/stripeLiveCheckout";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const result=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"no-store"}});
function sameSecret(actual:string,expected:string){
 const a=Buffer.from(actual),b=Buffer.from(expected);
 return a.length===b.length&&timingSafeEqual(a,b);
}
/** Server-to-server only. Never expose the shared secret, guest names or booking IDs. */
export async function POST(req:NextRequest){
 const key=process.env.CROSS_SITE_TICKET_VERIFY_SECRET;
 if(!key||key.length<32)return result({error:"Ticket verification unavailable"},503);
 const bearer=req.headers.get("authorization")??"";
 if(!sameSecret(bearer,"Bearer "+key))return result({error:"Unauthorised"},401);
 let body:unknown;
 try{
  const raw=await req.text();
  if(raw.length>2000)return result({error:"Request too large"},413);
  body=JSON.parse(raw);
 }catch{return result({error:"Invalid JSON"},400)}
 if(!body||typeof body!=="object")return result({error:"Invalid request"},400);
 const {eventId,reference,email}=body as Record<string,unknown>;
 if(eventId!==NYE_EVENT_ID||typeof reference!=="string"||typeof email!=="string")
  return result({valid:false});
 const ref=reference.trim().toUpperCase().replace(/\s+/g,"");
 const contact=email.trim().toLowerCase();
 if(!/^YMR-[A-Z0-9-]{5,80}$/.test(ref)||contact.length>254||
  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact))
  return result({valid:false});
 const url=process.env.SUPABASE_URL??process.env.NEXT_PUBLIC_SUPABASE_URL;
 const secret=process.env.SUPABASE_SECRET_KEY??process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||new URL(url).hostname!=="vzzabkviwyarrdkevqco.supabase.co"||!secret)
  return result({error:"Ticket verification unavailable"},503);
 const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:booking,error}=await db.from("bookings")
  .select("id,status,event_id").eq("event_id",eventId)
  .eq("booking_reference",ref).maybeSingle();
 if(error)return result({error:"Verification temporarily unavailable"},503);
 if(!booking||booking.status!=="confirmed")return result({valid:false});
 const [{data:paid,error:payError},{data:guests,error:guestError}]=await Promise.all([
  db.from("booking_live_checkouts")
   .select("state,stripe_session_id,stripe_payment_intent_id")
   .eq("booking_id",booking.id).maybeSingle(),
  db.from("booking_guests")
   .select("email,category,is_child_with_adult_seat")
   .eq("booking_id",booking.id)
 ]);
 if(payError||guestError)return result({error:"Verification temporarily unavailable"},503);
 const paidLive=paid?.state==="paid"&&
   paid.stripe_session_id?.startsWith("cs_live_")&&
   paid.stripe_payment_intent_id?.startsWith("pi_");
 const matchingAdult=(guests??[]).some(g=>
   g.category==="adult"&&!g.is_child_with_adult_seat&&
   typeof g.email==="string"&&g.email.trim().toLowerCase()===contact);
 return result({valid:!!paidLive&&matchingAdult});
}
