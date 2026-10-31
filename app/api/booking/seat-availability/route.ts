import {NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
export const dynamic="force-dynamic";
const uuid=/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i;
export async function GET(request:Request){
 const id=new URL(request.url).searchParams.get("eventId")||"";
 if(!uuid.test(id))return NextResponse.json({error:"Invalid event"},{status:400});
 const url=process.env.SUPABASE_URL??process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.SUPABASE_SECRET_KEY??process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return NextResponse.json({error:"Availability unavailable"},{status:503});
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const [bookings,holds]=await Promise.all([
  db.from("bookings").select("id").eq("event_id",id).in("status",["confirmed","test_confirmed"]),
  db.from("booking_live_checkouts").select("booking_id").eq("event_id",id).in("state",["creating","open","paid","needs_review"])
 ]);
 if(bookings.error||holds.error)return NextResponse.json({error:"Availability unavailable"},{status:503});
 const ids=[...new Set([...(bookings.data??[]).map(x=>x.id),...(holds.data??[]).map(x=>x.booking_id)])];
 if(!ids.length)return NextResponse.json({unavailable:[]},{headers:{"Cache-Control":"no-store"}});
 const {data,error}=await db.from("booking_selections").select("table_id,seat_number").in("booking_id",ids);
 if(error)return NextResponse.json({error:"Availability unavailable"},{status:503});
 const unavailable=[...new Set((data??[]).map(s=>s.seat_number===null?s.table_id:s.table_id+":"+s.seat_number))];
 return NextResponse.json({unavailable},{headers:{"Cache-Control":"no-store"}});
}
