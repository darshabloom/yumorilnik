"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {supabase} from "@/lib/supabaseClient";
import {useSiteLanguage} from "@/lib/useSiteLanguage";
type BookingRow={id:string;booking_reference:string;status:string;created_at:string;booking_guests:{guest_index:number;category:string;email:string|null}[]};
type Correction={booking_id:string;recipient_email:string;recipient_type:string;status:string;provider_message_id:string|null;sent_at:string|null;error_message:string|null};
type Outcome={email:string;kind:string;status:string};
export default function SendCorrectedEmails(){
 const en=useSiteLanguage()==="en";
 const [bookings,setBookings]=useState<BookingRow[]>([]);
 const [corrections,setCorrections]=useState<Correction[]>([]);
 const [loading,setLoading]=useState(true),[working,setWorking]=useState<string|null>(null);
 const [error,setError]=useState(""),[result,setResult]=useState<{reference:string;outcomes:Outcome[]}|null>(null);
 async function token(){
  const {data:{session}}=await supabase.auth.getSession();
  if(!session)throw Error("Admin sign-in required");
  return session.access_token;
 }
 async function load(){
  setLoading(true);setError("");
  try{
   const key=await token();
   const {data:{user}}=await supabase.auth.getUser();
   if(!user)throw Error("Sign-in required");
   const {data:role,error:roleError}=await supabase.from("admin_users").select("role").eq("user_id",user.id).maybeSingle();
   if(roleError||!role||!["owner","admin"].includes(role.role))throw Error("Organiser access required");
   const {data:rows,error:bookingError}=await supabase.from("bookings")
    .select("id,booking_reference,status,created_at,booking_guests(guest_index,category,email)")
    .eq("status","confirmed").order("created_at",{ascending:false}).limit(60);
   if(bookingError)throw bookingError;
   const response=await fetch("/api/admin/send-corrected-confirmations",{
    headers:{Authorization:"Bearer "+key},cache:"no-store"});
   const body=await response.json();
   if(!response.ok)throw Error(body.error??"Unable to load correction history");
   setBookings((rows??[]) as BookingRow[]);
   setCorrections(body.records??[]);
  }catch(e){setError(e instanceof Error?e.message:String(e))}
  finally{setLoading(false)}
 }
 useEffect(()=>{void load()},[]); // eslint-disable-line react-hooks/exhaustive-deps
 const rows=useMemo(()=>bookings.filter(b=>b.booking_guests.some(g=>g.category==="adult"&&g.email)).map(b=>{
  const emails=new Set(b.booking_guests.filter(g=>g.category==="adult"&&g.email).map(g=>g.email!.toLowerCase()));
  const status=corrections.filter(c=>c.booking_id===b.id);
  return {booking:b,addresses:emails.size,corrections:status};
 }),[bookings,corrections]);
 async function send(booking:BookingRow,addresses:number){
  const prompt=en?
   "Send an updated confirmation to "+addresses+" distinct customer email address(es), plus one consolidated organiser email for booking "+booking.booking_reference+"? Already-sent updates will be skipped.":
   "Отправить обновлённые билеты "+addresses+" получателям и одну сводку организатору для брони "+booking.booking_reference+"? Ранее отправленные обновления будут пропущены.";
  if(!window.confirm(prompt))return;
  setWorking(booking.id);setResult(null);setError("");
  try{
   const key=await token();
   const response=await fetch("/api/admin/send-corrected-confirmations",{
    method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json"},
    body:JSON.stringify({bookingId:booking.id})});
   const body=await response.json() as {bookingReference?:string;results?:Outcome[];error?:string};
   if(!response.ok)throw Error(body.error??"Unable to send updated confirmations");
   setResult({reference:body.bookingReference??booking.booking_reference,outcomes:body.results??[]});
   await load();
  }catch(e){setError(e instanceof Error?e.message:String(e))}
  finally{setWorking(null)}
 }
 return <main className="min-h-screen bg-[#fff2db] p-5 text-black sm:p-8"><section className="mx-auto max-w-5xl">
  <Link href="/admin" className="font-bold underline">{en?"← Dashboard":"← Панель управления"}</Link>
  <h1 className="mt-6 text-3xl font-black">{en?"Send updated booking confirmations":"Отправить обновлённые подтверждения"}</h1>
  <p className="mt-3 max-w-3xl">{en?
   "Send one clearly marked correction per unique adult email address, showing all members of the booking and their seats. Attach tickets for the recipients using that address. Yumorilnik receives one consolidated email with every ticket. Previously sent corrections are not sent again.":
   "Одно обновлённое письмо на каждый уникальный адрес: все гости, места и билеты для этого адреса. Организатор получит одну сводку со всеми билетами. Повторная отправка уже отправленных писем исключена."}</p>
  <p className="mt-2 text-sm text-gray-700">{en?"Only previously emailed, confirmed and verified paid bookings are eligible. The server checks eligibility again before sending.":"Доступно только для ранее отправленных, подтверждённых и оплаченных броней. Сервер повторно проверяет условия перед отправкой."}</p>
  <button className="mt-4 rounded-lg border border-black px-4 py-2 font-bold" onClick={()=>void load()} disabled={loading}>{en?"Refresh":"Обновить"}</button>
  {error&&<p role="alert" className="mt-4 rounded-lg bg-red-100 p-4 text-red-900">{error}</p>}
  {result&&<section className="mt-5 rounded-xl border border-black bg-white p-5">
   <h2 className="text-lg font-black">{en?"Dispatch results":"Результаты отправки"} · {result.reference}</h2>
   <ul className="mt-2 list-disc pl-5">{result.outcomes.map((x,i)=><li key={i}>{x.kind==="organiser"?"Organiser / Организатор":"Customer / Покупатель"}: {x.email} — {x.status}</li>)}</ul>
   <p className="mt-2 text-sm text-gray-600">{en?"Accepted by provider means Resend accepted the message; check inbox delivery in Resend.":"Принято провайдером означает, что Resend принял письмо; доставку проверьте в Resend."}</p>
  </section>}
  {loading?<p className="mt-6">{en?"Loading…":"Загрузка…"}</p>:<div className="mt-6 space-y-3">{rows.map(({booking,addresses,corrections:history})=>{
   const accepted=history.filter(c=>c.status==="sent").length;
   return <article key={booking.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-black bg-white p-5">
    <div><h2 className="text-lg font-black">{booking.booking_reference}</h2>
     <p className="text-sm">{addresses} {en?"distinct customer addresses":"уникальных адресов"} · {history.length} {en?"tracked corrections":"записей об обновлениях"}</p>
     {history.length>0&&<p className="mt-1 text-sm">{accepted}/{history.length} {en?"accepted by Resend":"принято Resend"}</p>}
    </div>
    <button onClick={()=>void send(booking,addresses)} disabled={Boolean(working)}
     className="rounded-lg bg-black px-5 py-3 font-bold text-white disabled:opacity-50">
     {working===booking.id?(en?"Sending…":"Отправляем…"):en?"Send updated confirmation":"Отправить обновлённые письма"}
    </button>
   </article>
  })}{rows.length===0&&<p>{en?"No eligible booking candidates found":"Нет подходящих броней"}</p>}</div>}
  <Link href="/admin/email-history" className="mt-8 inline-block underline">{en?"Email History":"История писем"}</Link>
 </section></main>;
}
