import {timingSafeEqual} from "node:crypto";
import {createClient} from "@supabase/supabase-js";
import {NextRequest,NextResponse} from "next/server";
import {bookingConfirmationEmail} from "@/lib/bookingConfirmationEmail";
import {createTicketPdf} from "@/lib/ticketPdf";
import {bookingConfirmationHtml} from "@/lib/bookingConfirmationTemplate";

export const runtime="nodejs";
export const dynamic="force-dynamic";

type Delivery={
 booking_id:string;
 guest_index:number;
 recipient_email:string;
 status:"pending"|"failed"|"sending"|"sent";
 attempts:number;
};
type Guest={
 guest_index:number;
 category:"adult"|"child";
 full_name:string;
 email:string|null;
 accompanying_adult_index:number|null;
 guardian_index:number|null;
 is_child_with_adult_seat:boolean;
 childcare_hours:number|null;
};
type Selection={
 guest_index:number|null;
 table_label:string;
 seat_number:number|null;
};
type Booking={
 id:string;
 booking_reference:string;
 event_id:string;
 status:string;
 total_cents:number|null;
 currency:string;
 promo_code:string|null;
 events:{title:string;title_en:string|null;event_date:string|null;event_time:string|null;location:string|null;slug:string|null}|null;
 booking_guests:Guest[];
 booking_selections:Selection[];
};

function matchesSecret(candidate:string,secret:string){
 if(!candidate||!secret)return false;
 const lhs=Buffer.from(candidate);const rhs=Buffer.from(secret);
 return lhs.length===rhs.length&&timingSafeEqual(lhs,rhs);
}
function json(result:unknown,status=200){
 return NextResponse.json(result,{status,headers:{"Cache-Control":"no-store"}});
}
function safeError(error:unknown){
 return error instanceof Error?error.message.slice(0,400):"Unknown email provider error";
}

/**
 * Explicit, authenticated server-only queue processor.
 * Do not expose CRON_SECRET, SUPABASE_SECRET_KEY or RESEND_API_KEY to browser code.
 * A real sender domain must be verified; the route is inert until enabled.
 */
export async function POST(request:NextRequest){
 const cronSecret=process.env.BOOKING_EMAIL_PROCESSOR_SECRET;
 const authorisation=request.headers.get("authorization")??"";
 if(!cronSecret||!matchesSecret(authorisation,`Bearer ${cronSecret}`))return json({error:"Unauthorised"},401);
 if(process.env.BOOKING_EMAILS_ENABLED!=="true")return json({error:"Confirmation email sending is disabled"},503);
 const url=process.env.SUPABASE_URL??process.env.NEXT_PUBLIC_SUPABASE_URL;
 const secretKey=process.env.SUPABASE_SECRET_KEY;
 const resendKey=process.env.RESEND_API_KEY;
 const from=process.env.RESEND_FROM_EMAIL;
 if(!url||!secretKey||!resendKey||!from||!/^\S+@[^\s@]+\.[^\s@]+$/.test(from))
  return json({error:"Missing trusted Supabase or verified Resend sender configuration"},503);
 if(from.toLowerCase().endsWith("@resend.dev"))
  return json({error:"A verified Yumorilnik sending domain is required for real recipients"},503);

 const db=createClient(url,secretKey,{auth:{autoRefreshToken:false,persistSession:false}});
 // List only PAID live bookings first. Legacy manually confirmed bookings must
 // never monopolise the queue or receive live admission credentials.
 const {data:paidRows,error:paidError}=await db.from("booking_live_checkouts")
  .select("booking_id").eq("state","paid").limit(1000);
 if(paidError)return json({error:"Unable to verify paid live bookings"},502);
 const paidIds=(paidRows??[]).map(x=>x.booking_id);
 if(paidIds.length===0)return json({reviewed:0,sent:0,failed:0,skipped:0,ineligible:0});
 const {data:rows,error:listError}=await db.from("booking_confirmation_deliveries")
  .select("booking_id,guest_index,recipient_email,status,attempts")
  .in("booking_id",paidIds).in("status",["pending","failed"]).lt("attempts",3)
  .order("last_attempt_at",{ascending:true,nullsFirst:true}).limit(12);
 if(listError)return json({error:"Unable to read paid confirmation queue"},502);
 let sent=0,failed=0,skipped=0,ineligible=0;
 for(const record of rows??[]){
  const delivery=record as Delivery;
  // Never process historical manually confirmed or sandbox bookings. The
  // live Stripe ledger must itself show a genuinely paid Checkout session.
  const {data:live,error:liveError}=await db.from("booking_live_checkouts")
   .select("state,amount_cents,currency,stripe_session_id,stripe_payment_intent_id")
   .eq("booking_id",delivery.booking_id).maybeSingle();
  if(liveError)return json({error:"Unable to verify live payment status"},502);
  if(!live||live.state!=="paid"||live.currency!=="nzd"||
   !live.stripe_session_id?.startsWith("cs_live_")||
   !live.stripe_payment_intent_id?.startsWith("pi_")){
   ineligible++;continue;
  }
  // Atomic conditional claim: concurrent processors cannot send the same row.
  const {data:claim,error:claimError}=await db.from("booking_confirmation_deliveries")
   .update({status:"sending",attempts:delivery.attempts+1,
    last_attempt_at:new Date().toISOString(),error_message:null})
   .eq("booking_id",delivery.booking_id).eq("guest_index",delivery.guest_index)
   .eq("status",delivery.status).eq("attempts",delivery.attempts)
   .select("booking_id").maybeSingle();
  if(claimError||!claim){skipped++;continue;}
  let providerAccepted=false;
  try{
   const {data:row,error:bookingError}=await db.from("bookings")
    .select("id,booking_reference,event_id,status,total_cents,currency,promo_code,events(title,title_en,event_date,event_time,location,slug),booking_guests(guest_index,category,full_name,email,accompanying_adult_index,guardian_index,is_child_with_adult_seat,childcare_hours),booking_selections(guest_index,table_label,seat_number)")
    .eq("id",delivery.booking_id).maybeSingle();
   if(bookingError||!row)throw new Error("Booking record unavailable");
   const booking=row as unknown as Booking;
   if(booking.status!=="confirmed"||booking.total_cents===null||
    booking.total_cents<50||booking.currency.toLowerCase()!=="nzd"||
    Number(live.amount_cents)!==Number(booking.total_cents))
    throw new Error("Booking or amount does not match a paid live Stripe checkout");
   // Stripe sandbox test_confirmed records are deliberately excluded. Paid
   // production bookings may be emailed only once genuine launch flows exist.
   const person=booking.booking_guests.find(g=>g.guest_index===delivery.guest_index&&g.category==="adult"&&!g.is_child_with_adult_seat);
   if(!person||!person.email||person.email.toLowerCase()!==delivery.recipient_email.toLowerCase())
    throw new Error("Recipient does not match this booking");
   const children=booking.booking_guests.filter(g=>(g.category==="child"&&g.accompanying_adult_index===person.guest_index)||(g.is_child_with_adult_seat&&g.guardian_index===person.guest_index));
   const namedGuests=[person,...children];
   const places=booking.booking_selections
    .filter(seat=>seat.guest_index===null||namedGuests.some(g=>g.guest_index===seat.guest_index))
    .map(seat=>({guestName:booking.booking_guests.find(g=>g.guest_index===seat.guest_index)?.full_name??person.full_name,
     table:seat.table_label,seat:seat.seat_number}));
   const common={
    reference:booking.booking_reference,
    eventDateText:(booking.events?.event_date??"See event details / Проверьте информацию о мероприятии")+" "+(booking.events?.event_time??""),
    adults:[{name:person.full_name,email:person.email}],
    children:children.map(g=>({name:g.full_name,accompanyingAdultEmail:person.email!,childcareHours:g.childcare_hours,adultPricedSeat:g.is_child_with_adult_seat})),
    places,promoCode:booking.promo_code,totalCents:booking.total_cents,
    currency:booking.currency||"NZD",
   };
   // Bilingual until a booking-language field is designed and agreed.
   const en=bookingConfirmationEmail({...common,language:"en",eventName:booking.events?.title_en||booking.events?.title||"Yumorilnik event"});
   const ru=bookingConfirmationEmail({...common,language:"ru",eventName:booking.events?.title||"Мероприятие Юморильника"});
   if(!booking.events?.event_date||!booking.events.title)
    throw new Error("Event information is incomplete");
   // Attach only this adult's ticket and their own associated children;
   // never include another adult's private booking data in the PDF.
   const pdf=await createTicketPdf({
    bookingId:booking.id,reference:booking.booking_reference,
    event:{title:booking.events.title,event_date:booking.events.event_date,
     event_time:booking.events.event_time,location:booking.events.location},
    guests:namedGuests,seats:booking.booking_selections.filter(seat=>
     seat.guest_index!==null&&namedGuests.some(g=>g.guest_index===seat.guest_index)),
    isTest:false,
   });
   const html=bookingConfirmationHtml({
    reference:booking.booking_reference,eventTitle:booking.events.title,
    eventDate:booking.events.event_date+" "+(booking.events.event_time??""),
    venue:booking.events.location,guests:namedGuests.map(g=>{
      const seat=booking.booking_selections.find(s=>s.guest_index===g.guest_index);
      return {name:g.full_name,ticket:g.is_child_with_adult_seat?"Adult-priced seat / Место по взрослому тарифу":g.category==="child"?"Childcare / Детский":"Adult / Взрослый",
       table:seat?.table_label??null,seat:seat?.seat_number??null,
       childcareHours:g.childcare_hours??null};
    }),isTest:false,
    eventUrl:booking.events.slug?"https://yumorilnik.com/events/"+encodeURIComponent(booking.events.slug):null,
    matryoshkaUrl:"https://matryoshka.nz",
   });
   const response=await fetch("https://api.resend.com/emails",{
    method:"POST",
    headers:{"Authorization":`Bearer ${resendKey}`,"Content-Type":"application/json",
     "Idempotency-Key":"ymr-paid-ticket-v1-"+booking.id+"-"+delivery.guest_index},
    body:JSON.stringify({
     from:`Yumorilnik Tickets <${from}>`,reply_to:"yumorilnik@gmail.com",to:[person.email],subject:en.subject,
     text:en.text+"\n\n---\n\n"+ru.text,html,
     attachments:[{filename:"yumorilnik-tickets-"+booking.booking_reference+".pdf",content:pdf.toString("base64")}],
    }),
   });
   const provider=await response.json() as {id?:string;message?:string};
   if(!response.ok||!provider.id)throw new Error(`Resend rejected email (${response.status}): ${(provider.message??"unknown").slice(0,120)}`);
   providerAccepted=true;
   const {error:markError}=await db.from("booking_confirmation_deliveries")
    .update({status:"sent",provider_message_id:provider.id,sent_at:new Date().toISOString(),error_message:null})
    .eq("booking_id",delivery.booking_id).eq("guest_index",delivery.guest_index)
    .eq("status","sending");
   if(markError)throw new Error("Provider accepted email; recording delivery failed");
   sent++;
  }catch(error){
   // Once Resend has accepted the message, NEVER blindly requeue if the
   // subsequent DB acknowledgement failed: that could duplicate tickets.
   // Retain the "sending" row for explicit operator reconciliation.
   if(providerAccepted){skipped++;continue}
   const {error:updateError}=await db.from("booking_confirmation_deliveries")
    .update({status:"failed",error_message:safeError(error)})
    .eq("booking_id",delivery.booking_id).eq("guest_index",delivery.guest_index)
    .eq("status","sending");
   if(updateError)skipped++;
   failed++;
  }
  const {data:statuses}=await db.from("booking_confirmation_deliveries")
   .select("status").eq("booking_id",delivery.booking_id);
  const allSent=(statuses??[]).length>0&&(statuses??[]).every(s=>s.status==="sent");
  const anyFailed=(statuses??[]).some(s=>s.status==="failed");
  await db.from("bookings").update({
   confirmation_email_status:allSent?"sent":anyFailed?"failed":"pending",
  }).eq("id",delivery.booking_id).eq("status","confirmed");
  await db.from("booking_confirmation_outbox").update({
   status:allSent?"sent":anyFailed?"failed":"pending",
   sent_at:allSent?new Date().toISOString():null,
  }).eq("booking_id",delivery.booking_id);
 }
 return json({reviewed:(rows??[]).length,sent,failed,skipped,ineligible});
}
