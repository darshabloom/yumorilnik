import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
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
 const {data:event}=await db.from("events").select("title,event_date").eq("id","3f6fa4d1-aaca-4326-9c01-5774cffca2f5").maybeSingle();
 const title=escapeHtml(event?.title??"Новогодник");
 const date=event?.event_date?escapeHtml(String(event.event_date)):"Date and time to be confirmed";
 const html=`<div style="font:16px Arial,sans-serif;max-width:620px;margin:auto;color:#171717"><div style="background:#f5a047;padding:26px"><h1 style="margin:0">Юморильник</h1><p>TEST / ТЕСТ — sample email, not a valid ticket</p></div><div style="padding:26px"><h2>Ваше бронирование / Booking confirmation</h2><p><strong>${title}</strong></p><p>Дата / Date: ${date}</p><p>Booking reference: <strong>TEST-YMR-EXAMPLE</strong></p><p>Guest / Гость: Sample Guest</p><p>Seat / Место: Example table A, seat 1</p><p>Ticket: 1 adult-priced seat (sample only)</p><p>Please bring your actual booking confirmation and follow the event details provided by the organiser. Venue, doors opening and parking information will be included once confirmed.</p><hr/><h3>Еда на мероприятии / Food ordering</h3><p>Matryoshka pre-ordering will be available from your booking confirmation. Your food order will be linked to your event booking once the secure integration is ready.</p><p style="background:#fff2db;padding:15px"><strong>PREVIEW ONLY</strong> — Matryoshka ticket-linked food ordering is not active yet.</p><p>This test message was requested from Yumorilnik's organiser dashboard. No payment or reservation was created.</p></div></div>`;
 try{
  const res=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":"Bearer "+apiKey,"Content-Type":"application/json"},body:JSON.stringify({from:sender,to:[user.email],subject:"[TEST] Юморильник — booking confirmation preview",html})});
  const data=await res.json() as {id?:string;message?:string;name?:string};
  if(!res.ok)return respond({error:"Email provider rejected the test: "+(data.message??data.name??"unknown error")},502);
  return respond({ok:true,to:user.email,messageId:data.id??null});
 }catch{return respond({error:"Email provider unavailable"},502)}
}
