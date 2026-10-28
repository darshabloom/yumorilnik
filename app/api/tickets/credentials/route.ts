import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {issueTicketCredential,parseTicketCredential} from "@/lib/ticketCredential";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{"Cache-Control":"no-store"}});
export async function POST(req:NextRequest){
 const origin=req.headers.get("origin");if(origin&&origin!==new URL(req.url).origin)return reply({error:"Cross-site request blocked"},403);
 const token=req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];if(!token)return reply({error:"Authentication required"},401);
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!key)return reply({error:"Ticket service unavailable"},503);
 const db=createClient(url,key,{global:{headers:{Authorization:"Bearer "+token}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error:authError}=await db.auth.getUser(token);if(authError||!user)return reply({error:"Sign in required"},401);
 let body:{action?:string;bookingId?:string;guestIndex?:number;credential?:string;eventId?:string};
 try{body=await req.json()}catch{return reply({error:"Invalid request"},400)}
 if(body.action==="issue"){
  const {data:role}=await db.from("admin_users").select("role").eq("user_id",user.id).maybeSingle();
  if(!role||!["owner","admin"].includes(role.role))return reply({error:"Only organisers can issue ticket credentials"},403);
  if(typeof body.bookingId!=="string"||!Number.isInteger(body.guestIndex))return reply({error:"Invalid ticket identity"},400);
  const {data:booking,error}=await db.from("bookings").select("status,booking_guests(guest_index)").eq("id",body.bookingId).maybeSingle();
  if(error||!booking||booking.status!=="confirmed")return reply({error:"Only confirmed real bookings qualify"},409);
  if(!(booking.booking_guests??[]).some((g:{guest_index:number})=>g.guest_index===body.guestIndex))return reply({error:"Guest missing"},404);
  try{return reply({credential:issueTicketCredential(body.bookingId,body.guestIndex!)})}catch{return reply({error:"Ticket signing unavailable"},503)}
 }
 if(body.action==="check"){
  if(typeof body.credential!=="string"||typeof body.eventId!=="string")return reply({error:"Invalid scan"},400);
  let parsed:ReturnType<typeof parseTicketCredential>;
  try{parsed=parseTicketCredential(body.credential)}catch{return reply({error:"Ticket validation unavailable"},503)}
  if(!parsed)return reply({error:"Invalid ticket code"},400);
  const {data:guests,error:listError}=await db.rpc("staff_list_event_guests",{p_event_id:body.eventId});
  if(listError)return reply({error:"Event check-in access denied"},403);
  const guest=(guests??[]).find((g:{booking_id:string;guest_index:number})=>g.booking_id===parsed.bookingId&&g.guest_index===parsed.guestIndex);
  if(!guest)return reply({error:"Ticket is not valid for this event"},404);
  if(guest.checked_in_at)return reply({error:"Ticket already checked in",guest:guest.full_name},409);
  const {data:updated,error:updateError}=await db.rpc("staff_set_guest_checkin",{p_booking_id:parsed.bookingId,p_guest_index:parsed.guestIndex,p_arrived:true});
  if(updateError||updated!==true)return reply({error:"Could not record check-in"},409);
  return reply({ok:true,name:guest.full_name,bookingReference:guest.booking_reference});
 }
 return reply({error:"Unknown ticket action"},400);
}
