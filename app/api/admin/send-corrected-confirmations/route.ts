import {NextRequest,NextResponse} from "next/server";
import {createClient, type SupabaseClient} from "@supabase/supabase-js";
import {createTicketPdf} from "@/lib/ticketPdf";
import {correctedConfirmation,type CorrectionGuest,type CorrectionSeat,type CorrectionEvent} from "@/lib/correctedBookingConfirmation";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const reply=(value:unknown,status=200)=>NextResponse.json(value,{status,headers:{"Cache-Control":"no-store"}});
async function admin(request:NextRequest){
 const token=request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const pub=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 const secret=process.env.SUPABASE_SECRET_KEY??process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!token||!url||!pub||!secret)return null;
 const auth=createClient(url,pub,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error}=await auth.auth.getUser(token);
 if(error||!user)return null;
 const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:membership,error:roleError}=await db.from("admin_users").select("role").eq("user_id",user.id).maybeSingle();
 if(roleError||!membership||!["owner","admin"].includes(membership.role))return null;
 return db;
}
type Booking={
 id:string;booking_reference:string;status:string;confirmed_at:string|null;total_cents:number|null;
 currency:string;promo_code:string|null;
 events:CorrectionEvent|null;booking_guests:CorrectionGuest[];booking_selections:CorrectionSeat[];
};
async function getBooking(db:SupabaseClient,bookingId:string):Promise<Booking|null>{
 const {data,error}=await db.from("bookings").select(
  "id,booking_reference,status,confirmed_at,total_cents,currency,promo_code,events(title,title_en,event_date,event_time,location,slug),booking_guests(guest_index,full_name,email,category,is_child_with_adult_seat,childcare_hours,guardian_index,accompanying_adult_index),booking_selections(guest_index,table_label,seat_number)"
 ).eq("id",bookingId).maybeSingle();
 if(error)throw new Error("Booking lookup failed");
 return data as unknown as Booking|null;
}
async function eligible(db:SupabaseClient,booking:Booking){
 if(booking.status!=="confirmed"||booking.total_cents===null)return false;
 const {data:paid,error}=await db.from("booking_live_checkouts")
  .select("state,currency,amount_cents,stripe_session_id,stripe_payment_intent_id")
  .eq("booking_id",booking.id).maybeSingle();
 if(error||!paid||paid.state!=="paid"||paid.currency!=="nzd"||
  paid.amount_cents!==booking.total_cents||!paid.stripe_session_id?.startsWith("cs_live_")||
  !paid.stripe_payment_intent_id?.startsWith("pi_"))return false;
 const {count,error:historyError}=await db.from("booking_confirmation_deliveries")
  .select("booking_id",{count:"exact",head:true}).eq("booking_id",booking.id).eq("status","sent").gte("guest_index",0);
 return !historyError&&Number(count)>0;
}
const recipients=(booking:Booking)=>Array.from(new Set(booking.booking_guests
 .filter(g=>g.category==="adult"&&!g.is_child_with_adult_seat&&g.email)
 .map(g=>g.email!.toLowerCase().trim())));
function ticketRecipients(booking:Booking,email:string,organiser:boolean){
 const guests=booking.booking_guests;
 if(organiser)return guests;
 return guests.filter(g=>{
  const own=g.category==="adult"&&!g.is_child_with_adult_seat&&g.email?.toLowerCase().trim()===email;
  if(own)return true;
  if(g.category!=="child"&&!g.is_child_with_adult_seat)return false;
  const parentIndex=g.guardian_index??g.accompanying_adult_index;
  return guests.some(p=>p.guest_index===parentIndex&&p.email?.toLowerCase().trim()===email);
 });
}
export async function GET(request:NextRequest){
 const db=await admin(request);
 if(!db)return reply({error:"Organiser permission required"},403);
 const previewId=request.nextUrl.searchParams.get("previewBookingId");
 if(previewId){
  if(!/^[0-9a-f-]{36}$/i.test(previewId))return reply({error:"Invalid booking ID"},400);
  const booking=await getBooking(db,previewId);
  if(!booking||!booking.events||!await eligible(db,booking))
   return reply({error:"Only previously emailed, confirmed and paid bookings can be previewed"},409);
  const kind=request.nextUrl.searchParams.get("recipientType")==="organiser"?"organiser":"customer";
  const recipient=kind==="organiser"?"yumorilnik@gmail.com":
   (request.nextUrl.searchParams.get("email")??"").toLowerCase().trim();
  if(kind==="customer"&&!recipients(booking).includes(recipient))
   return reply({error:"Recipient does not belong to this booking"},403);
  const people=ticketRecipients(booking,recipient,kind==="organiser");
  const email=correctedConfirmation({reference:booking.booking_reference,event:booking.events,
   guests:booking.booking_guests,seats:booking.booking_selections,organiser:kind==="organiser",
   amountCents:booking.total_cents!,currency:booking.currency,promoCode:booking.promo_code});
  if(request.nextUrl.searchParams.get("format")==="pdf"){
   const pdf=await createTicketPdf({bookingId:booking.id,reference:booking.booking_reference,
    event:{title:booking.events.title,event_date:booking.events.event_date,
     event_time:booking.events.event_time,location:booking.events.location},
    guests:people,seats:booking.booking_selections.filter(s=>s.guest_index!==null&&people.some(p=>p.guest_index===s.guest_index)),
    isTest:false,issuedAt:booking.confirmed_at});
   return new NextResponse(new Uint8Array(pdf),{headers:{"Content-Type":"application/pdf",
    "Content-Disposition":'attachment; filename="yumorilnik-updated-tickets-'+booking.booking_reference+'.pdf"',
    "Cache-Control":"no-store"}});
  }
  return reply({reference:booking.booking_reference,recipient,recipientType:kind,
   subject:email.subject,html:email.html,
   attachments:[{filename:"yumorilnik-updated-tickets-"+booking.booking_reference+".pdf",
    guests:people.map(p=>p.full_name),pages:people.length}]});
 }
 const {data,error}=await db.from("booking_confirmation_corrections")
  .select("booking_id,recipient_email,recipient_type,status,provider_message_id,sent_at,error_message")
  .order("last_attempt_at",{ascending:false,nullsFirst:false}).limit(200);
 if(error)return reply({error:"Unable to load correction history"},502);
 return reply({records:data??[]});
}
export async function POST(request:NextRequest){
 const origin=request.headers.get("origin");
 if(origin&&origin!==new URL(request.url).origin)return reply({error:"Invalid request origin"},403);
 const db=await admin(request);
 if(!db)return reply({error:"Organiser permission required"},403);
 let bookingId="";
 try{
  const body=await request.json() as {bookingId?:unknown};
  if(typeof body.bookingId==="string")bookingId=body.bookingId;
 }catch{return reply({error:"Invalid request"},400)}
 if(!/^[0-9a-f-]{36}$/i.test(bookingId))return reply({error:"Invalid booking"},400);
 const apiKey=process.env.RESEND_API_KEY,from=process.env.RESEND_FROM_EMAIL;
 if(!apiKey||!from)return reply({error:"Email sending not configured"},503);
 const booking=await getBooking(db,bookingId);
 if(!booking||!booking.events||!await eligible(db,booking))
  return reply({error:"Only previously emailed, verified paid and currently confirmed bookings can receive an update"},409);
 const party=booking.booking_guests;
 const emails=recipients(booking);
 if(emails.length===0)return reply({error:"No adult recipients"},409);
 const targets=[...emails.map(email=>({email,kind:"customer" as const})),
  {email:"yumorilnik@gmail.com",kind:"organiser" as const}];
 const results:{email:string;kind:string;status:string}[]=[];
 for(const target of targets){
  const {error:insertError}=await db.from("booking_confirmation_corrections").upsert({
   booking_id:bookingId,recipient_email:target.email,recipient_type:target.kind,status:"pending"
  },{onConflict:"booking_id,recipient_email,recipient_type",ignoreDuplicates:true});
  if(insertError){results.push({email:target.email,kind:target.kind,status:"tracking_error"});continue}
  const {data:claimed,error:claimError}=await db.from("booking_confirmation_corrections")
   .update({status:"sending",attempts:1,last_attempt_at:new Date().toISOString(),error_message:null})
   .eq("booking_id",bookingId).eq("recipient_email",target.email).eq("recipient_type",target.kind)
   .eq("status","pending").select("booking_id").maybeSingle();
  if(claimError||!claimed){results.push({email:target.email,kind:target.kind,status:"already_processed"});continue}
  let accepted=false;
  try{
   const people=ticketRecipients(booking,target.email,target.kind==="organiser");
   const pdf=await createTicketPdf({
    bookingId:booking.id,reference:booking.booking_reference,
    event:{title:booking.events.title,event_date:booking.events.event_date,
     event_time:booking.events.event_time,location:booking.events.location},
    guests:people,seats:booking.booking_selections.filter(s=>s.guest_index!==null&&
     people.some(p=>p.guest_index===s.guest_index)),isTest:false,issuedAt:booking.confirmed_at
   });
   const message=correctedConfirmation({
    reference:booking.booking_reference,event:booking.events,guests:party,seats:booking.booking_selections,
    organiser:target.kind==="organiser",amountCents:booking.total_cents!,
    currency:booking.currency,promoCode:booking.promo_code
   });
   const result=await fetch("https://api.resend.com/emails",{
    method:"POST",headers:{"Authorization":"Bearer "+apiKey,"Content-Type":"application/json",
     "Idempotency-Key":"ymr-correction-v1-"+bookingId+"-"+target.kind+"-"+target.email},
    body:JSON.stringify({from:"Yumorilnik Tickets <"+from+">",to:[target.email],
     reply_to:"yumorilnik@gmail.com",subject:message.subject,html:message.html,text:message.text,
     attachments:[{filename:"yumorilnik-updated-tickets-"+booking.booking_reference+".pdf",
      content:pdf.toString("base64")}]})
   });
   const provider=await result.json() as {id?:string;message?:string};
   if(!result.ok||!provider.id)throw new Error("Resend rejected the update: "+(provider.message??result.status));
   accepted=true;
   const {error:recordError}=await db.from("booking_confirmation_corrections")
    .update({status:"sent",provider_message_id:provider.id,sent_at:new Date().toISOString()})
    .eq("booking_id",bookingId).eq("recipient_email",target.email).eq("recipient_type",target.kind)
    .eq("status","sending");
   if(recordError)throw new Error("Provider accepted email; manual delivery reconciliation required");
   results.push({email:target.email,kind:target.kind,status:"accepted_by_provider"});
  }catch(error){
   if(!accepted)await db.from("booking_confirmation_corrections")
    .update({status:"failed",error_message:error instanceof Error?error.message.slice(0,250):"Unknown error"})
    .eq("booking_id",bookingId).eq("recipient_email",target.email).eq("recipient_type",target.kind)
    .eq("status","sending");
   results.push({email:target.email,kind:target.kind,status:accepted?"manual_review":"failed"});
  }
 }
 return reply({bookingReference:booking.booking_reference,results});
}
