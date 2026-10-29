import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {createTicketPdf} from "@/lib/ticketPdf";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function GET(req:NextRequest){
 const token=req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];if(!token)return NextResponse.json({error:"Unauthorised"},{status:401});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,pub=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,secret=process.env.SUPABASE_SECRET_KEY??process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!pub||!secret)return NextResponse.json({error:"Not configured"},{status:503});
 const userDb=createClient(url,pub,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user}}=await userDb.auth.getUser(token);if(!user)return NextResponse.json({error:"Sign in required"},{status:401});
 const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:role}=await db.from("admin_users").select("role").eq("user_id",user.id).maybeSingle();
 if(!role||!["owner","admin"].includes(role.role))return NextResponse.json({error:"Organiser access required"},{status:403});
 if(req.nextUrl.searchParams.get("sample")==="true"){
  try{
   const buffer=await createTicketPdf({bookingId:"00000000-0000-4000-8000-000000000000",reference:"TEST-YMR-CYRILLIC",event:{title:"Новогодник — Юморильник",event_date:"2026-12-31",event_time:"19:00",location:"Окленд, Новая Зеландия"},guests:[{guest_index:0,full_name:"Марина Иванова",category:"adult"},{guest_index:1,full_name:"Дарья Петрова",category:"child",childcare_hours:3}],seats:[{guest_index:0,table_label:"А",seat_number:1}],isTest:true});
   return new NextResponse(new Uint8Array(buffer),{headers:{"Content-Type":"application/pdf","Content-Disposition":"attachment; filename=\"yumorilnik-cyrillic-sample.pdf\"","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
  }catch{return NextResponse.json({error:"Cyrillic sample PDF failed"},{status:503})}
 }
 const id=req.nextUrl.searchParams.get("bookingId");
 if(!id||! /^[0-9a-f-]{36}$/i.test(id))return NextResponse.json({error:"Invalid booking"},{status:400});
 const {data:booking,error}=await db.from("bookings").select("id,booking_reference,status,events(title,event_date,event_time,location),booking_guests(guest_index,full_name,category,is_child_with_adult_seat,childcare_hours),booking_selections(guest_index,table_label,seat_number)").eq("id",id).maybeSingle();
 if(error||!booking)return NextResponse.json({error:"Booking not found"},{status:404});
 if(!["confirmed","test_confirmed"].includes(booking.status))return NextResponse.json({error:"Only confirmed or sandbox paid bookings may be previewed"},{status:409});
 // A manually confirmed booking is not evidence of a successful payment.
 // PDF previews without a genuine paid live ledger must have NO valid QR.
 const {data:live,error:paidError}=await db.from("booking_live_checkouts")
  .select("state,stripe_session_id,stripe_payment_intent_id").eq("booking_id",id).maybeSingle();
 if(paidError)return NextResponse.json({error:"Unable to verify ticket payment"},{status:503});
 const realPaid=booking.status==="confirmed"&&live?.state==="paid"&&
  live.stripe_session_id?.startsWith("cs_live_")&&
  live.stripe_payment_intent_id?.startsWith("pi_");
 try{
  const event=booking.events as unknown as {title:string;event_date:string;event_time:string|null;location:string|null};
  const buffer=await createTicketPdf({bookingId:booking.id,reference:booking.booking_reference,event,guests:booking.booking_guests??[],seats:booking.booking_selections??[],isTest:!realPaid});
  return new NextResponse(new Uint8Array(buffer),{headers:{"Content-Type":"application/pdf","Content-Disposition":"attachment; filename=\"yumorilnik-tickets.pdf\"","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
 }catch{return NextResponse.json({error:"Ticket PDF generation failed"},{status:503})}
}
