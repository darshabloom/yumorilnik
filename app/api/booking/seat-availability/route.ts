import {NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {stripeCall} from "@/lib/stripeLiveCheckout";
export const dynamic="force-dynamic";
const uuid=/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i;
export async function GET(request:Request){
 const id=new URL(request.url).searchParams.get("eventId")||"";
 if(!uuid.test(id))return NextResponse.json({error:"Invalid event"},{status:400});
 const url=process.env.SUPABASE_URL??process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.SUPABASE_SECRET_KEY??process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return NextResponse.json({error:"Availability unavailable"},{status:503});
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 // Expire abandoned live sessions after ten minutes before giving the next visitor
 // an availability answer. Stripe must confirm the session is expired first.
 // Paid or indeterminate sessions remain protected.
 const cutoff=new Date(Date.now()-10*60*1000).toISOString();
 if(process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_")||process.env.STRIPE_SECRET_KEY?.startsWith("rk_live_")){
  const {data:aged}=await db.from("booking_live_checkouts")
   .select("booking_id,stripe_session_id,state,created_at")
   .eq("event_id",id).in("state",["creating","open"]).lt("created_at",cutoff).limit(30);
  for(const hold of aged??[]){
   try{
    if(hold.state==="creating"&&!hold.stripe_session_id){
     await db.rpc("abandon_unbound_live_checkout",{p_booking_id:hold.booking_id});
     continue;
    }
    if(!hold.stripe_session_id)continue;
    const path="checkout/sessions/"+encodeURIComponent(hold.stripe_session_id);
    const session=await stripeCall<{id:string;livemode:boolean;status:string;payment_status:string}>(process.env.STRIPE_SECRET_KEY!,"GET",path);
    if(!session.livemode||session.id!==hold.stripe_session_id||session.payment_status==="paid"||session.status==="complete")continue;
    if(session.status==="open"){
     const expired=await stripeCall<{status:string}>(process.env.STRIPE_SECRET_KEY!,"POST",path+"/expire",new URLSearchParams());
     if(expired.status!=="expired")continue;
    }else if(session.status!=="expired")continue;
    await db.rpc("expire_live_checkout_session",{p_booking_id:hold.booking_id,p_session_id:hold.stripe_session_id});
   }catch(error){console.error("Live seat hold expiry deferred",hold.booking_id,error instanceof Error?error.message:"unknown")}
  }
 }
 const [bookings,holds]=await Promise.all([
  db.from("bookings").select("id").eq("event_id",id).in("status",["confirmed","test_confirmed"]),
  db.from("booking_live_checkouts").select("booking_id").eq("event_id",id).or(`state.in.(paid,needs_review),and(state.in.(creating,open),expires_at.gt.${new Date().toISOString()})`)
 ]);
 if(bookings.error||holds.error)return NextResponse.json({error:"Availability unavailable"},{status:503});
 const ids=[...new Set([...(bookings.data??[]).map(x=>x.id),...(holds.data??[]).map(x=>x.booking_id)])];
 if(!ids.length)return NextResponse.json({unavailable:[]},{headers:{"Cache-Control":"no-store"}});
 const {data,error}=await db.from("booking_selections").select("table_id,seat_number").in("booking_id",ids);
 if(error)return NextResponse.json({error:"Availability unavailable"},{status:503});
 const unavailable=[...new Set((data??[]).map(s=>s.seat_number===null?s.table_id:s.table_id+":"+s.seat_number))];
 return NextResponse.json({unavailable},{headers:{"Cache-Control":"no-store"}});
}
