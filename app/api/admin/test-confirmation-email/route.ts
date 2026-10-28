import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {bookingConfirmationHtml} from "@/lib/bookingConfirmationTemplate";
import {sampleQrTicketPdf} from "@/lib/sampleQrTicketPdf";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const respond=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{"Cache-Control":"no-store"}});
const escapeHtml=(value:string)=>value.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]||c));
export async function POST(req:NextRequest){
 const origin=req.headers.get("origin");
 if(origin&&origin!==new URL(req.url).origin)return respond({error:"Invalid request origin"},403);
 const token=req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
 if(!token)return respond({error:"Sign in required"},401);
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const pub=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 const secret=process.env.SUPABASE_SECRET_KEY??process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!pub||!secret)return respond({error:"Email test is not configured"},503);
 const auth=createClient(url,pub,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error:authError}=await auth.auth.getUser(token);
 if(authError||!user?.email)return respond({error:"Sign in required"},401);
 const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:member,error:roleError}=await db.from("admin_users").select("role").eq("user_id",user.id).maybeSingle();
 if(roleError||!member||!["owner","admin"].includes(member.role))return respond({error:"Organiser permission required"},403);
 const sender=process.env.RESEND_FROM_EMAIL,apiKey=process.env.RESEND_API_KEY;
 if(!sender||!apiKey)return respond({error:"Resend is not configured"},503);
 let bookingId: string|undefined;
 try{const body=await req.json() as {bookingId?:unknown};if(typeof body.bookingId==="string"&&/^[0-9a-f-]{36}$/i.test(body.bookingId))bookingId=body.bookingId;}catch{}
 let html:string;
 if(bookingId){
  const {data:booking,error:bookingError}=await db.from("bookings")
   .select("id,booking_reference,status,event_id,events(title,event_date,location,slug),booking_guests(guest_index,full_name,category,is_child_with_adult_seat,childcare_hours),booking_selections(guest_index,table_label,seat_number),booking_items(ticket_name,category,quantity)")
   .eq("id",bookingId).maybeSingle();
  if(bookingError||!booking)return respond({error:"Booking not found"},404);
  if(!["confirmed","test_confirmed"].includes(booking.status))return respond({error:"Choose a confirmed or sandbox-paid booking"},400);
  const event=booking.events as unknown as {title?:string;event_date?:string;location?:string;slug?:string}|null;
  const guests=(booking.booking_guests??[]) as {guest_index:number;full_name:string;category:string;is_child_with_adult_seat?:boolean;childcare_hours?:number|null}[];
  const selections=(booking.booking_selections??[]) as {guest_index:number|null;table_label:string;seat_number:number|null}[];
  const items=(booking.booking_items??[]) as {ticket_name:string;category:string;quantity:number}[];
  html=bookingConfirmationHtml({eventTitle:event?.title??"Yumorilnik event",eventDate:String(event?.event_date??"To be confirmed"),
   reference:booking.booking_reference,venue:event?.location??null,eventUrl:event?.slug?"https://yumorilnik.com/events/"+encodeURIComponent(event.slug):null,guests:guests.map(g=>{const seat=selections.find(x=>x.guest_index===g.guest_index);
    return {name:g.full_name,ticket:g.is_child_with_adult_seat?"Child · adult-priced seat":items.find(i=>i.category===g.category)?.ticket_name??(g.category==="child"?"Childcare":"Adult ticket"),
      table:seat?.table_label??null,seat:seat?.seat_number??null,childcareHours:g.childcare_hours??null};}),isTest:true,ticketUrl:"https://yumorilnik.com/tickets/sample"});
 }else{
  const {data:event}=await db.from("events").select("title,event_date,location,slug").eq("id","3f6fa4d1-aaca-4326-9c01-5774cffca2f5").maybeSingle();
  html=bookingConfirmationHtml({eventTitle:event?.title??"Новогодник",eventDate:String(event?.event_date??"To be confirmed"),reference:"TEST-YMR-EXAMPLE",venue:event?.location??null,eventUrl:event?.slug?"https://yumorilnik.com/events/"+encodeURIComponent(event.slug):null,guests:[{name:"Sample Guest",ticket:"Adult-priced seat",table:"Table A",seat:1},{name:"Sample Child",ticket:"Childcare",childcareHours:3}],isTest:true,ticketUrl:"https://yumorilnik.com/tickets/sample"});
 }
 try{
  const res=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":"Bearer "+apiKey,"Content-Type":"application/json"},body:JSON.stringify({from:sender,to:[user.email],subject:"[TEST] Юморильник — booking confirmation preview",html,attachments:[{filename:"Yumorilnik-SAMPLE-INVALID-Ticket.pdf",content:sampleQrTicketPdf().toString("base64"),content_type:"application/pdf"}]})});
  const data=await res.json() as {id?:string;message?:string;name?:string};
  if(!res.ok)return respond({error:"Email provider rejected the test: "+(data.message??data.name??"unknown error")},502);
  return respond({ok:true,to:user.email,messageId:data.id??null});
 }catch{return respond({error:"Email provider unavailable"},502)}
}
