"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {supabase} from "@/lib/supabaseClient";
import {useSiteLanguage} from "@/lib/useSiteLanguage";

type RecordRow={
 booking_id:string;guest_index:number;recipient_email:string;
 status:string;delivery_status:string;attempts:number;
 provider_message_id:string|null;error_message:string|null;
 last_attempt_at:string|null;sent_at:string|null;type:string;
 bookings:{booking_reference:string;status:string;created_at:string;events:{title:string;title_en:string|null}|null}|null;
};
const organiserCopy=(r:RecordRow)=>r.guest_index===0
 ? "Configured for organiser BCC (historical; delivery unverified)"
 : "No organiser BCC configured for this historical message";
const time=(value:string|null)=>value?new Date(value).toLocaleString("en-NZ",{timeZone:"Pacific/Auckland",dateStyle:"medium",timeStyle:"short"}):"—";
export default function EmailHistory(){
 const en=useSiteLanguage()==="en";
 const [records,setRecords]=useState<RecordRow[]>([]);
 const [busy,setBusy]=useState(false),[working,setWorking]=useState(""),[error,setError]=useState("");
 const [query,setQuery]=useState(""),[filter,setFilter]=useState("all"),[selected,setSelected]=useState<RecordRow|null>(null);
 async function load(){
  setBusy(true);setError("");
  try{
   const {data:{session}}=await supabase.auth.getSession();
   if(!session)throw Error(en?"Sign in as an administrator":"Войдите как администратор");
   const response=await fetch("/api/admin/email-history",{headers:{Authorization:"Bearer "+session.access_token},cache:"no-store"});
   const body=await response.json();
   if(!response.ok)throw Error(body.error??"Email history unavailable");
   setRecords(body.records??[]);
  }catch(err){setError(err instanceof Error?err.message:String(err))}
  finally{setBusy(false)}
 }
 useEffect(()=>{void load()},[]);// eslint-disable-line react-hooks/exhaustive-deps
 const visible=useMemo(()=>records.filter(r=>(filter==="all"||r.status===filter)&&
  [r.recipient_email,r.bookings?.booking_reference??"",r.provider_message_id??""].join(" ").toLowerCase().includes(query.toLowerCase())),[records,filter,query]);
 async function retry(row:RecordRow){
  if(!window.confirm(en?"Retry this failed confirmation email? The paid-booking checks will be repeated.":"Повторить отправку письма? Проверка оплаты будет выполнена снова."))return;
  setWorking(row.booking_id+":"+row.guest_index);setError("");
  try{
   const {data:{session}}=await supabase.auth.getSession();if(!session)throw Error("Sign in required");
   const res=await fetch("/api/admin/email-history",{method:"POST",headers:{
    Authorization:"Bearer "+session.access_token,"Content-Type":"application/json"},
    body:JSON.stringify({bookingId:row.booking_id,guestIndex:row.guest_index})});
   const data=await res.json();if(!res.ok)throw Error(data.error??"Retry failed");
   await load();
  }catch(e){setError(e instanceof Error?e.message:String(e))}
  finally{setWorking("")}
 }
 const status=(r:RecordRow)=>r.status==="sent"?(en?"Accepted by Resend":"Принято Resend"):r.status==="failed"?(en?"Failed":"Ошибка"):r.status==="sending"?(en?"Sending / check manually":"Отправляется / проверьте"):en?"Pending":"В очереди";
 return <main className="min-h-screen bg-[#fff2db] px-4 py-8 text-black sm:px-8"><section className="mx-auto max-w-6xl">
  <Link href="/admin" className="font-bold underline">{en?"← Admin dashboard":"← Панель управления"}</Link>
  <div className="mt-6 flex flex-wrap items-center justify-between gap-3"><div>
   <h1 className="text-3xl font-black">{en?"Email history":"История писем"}</h1>
   <p className="mt-2 max-w-3xl text-sm text-gray-700">{en?
   "Booking confirmation emails recorded by Yumorilnik. 'Accepted by Resend' means the provider accepted the message; inbox delivery and bounces must be checked in Resend. Test emails are visible in Resend only.":
   "Подтверждения бронирования, зарегистрированные на сайте. Статус «Принято Resend» не означает доставку во входящие. Проверяйте доставку и возвраты в Resend. Тестовые письма видны только в Resend."}</p></div>
   <button onClick={()=>void load()} disabled={busy} className="rounded-lg bg-black px-4 py-3 font-bold text-white disabled:opacity-50">{busy?(en?"Loading…":"Загрузка…"):(en?"Refresh":"Обновить")}</button>
  </div>
  <div className="mt-6 flex flex-wrap gap-3">
   <input aria-label={en?"Search emails":"Поиск писем"} placeholder={en?"Search email or booking reference":"Почта или номер брони"} className="min-w-60 flex-1 rounded-lg border border-black p-3" value={query} onChange={e=>setQuery(e.target.value)}/>
   <select aria-label={en?"Filter status":"Фильтр статуса"} className="rounded-lg border border-black p-3" value={filter} onChange={e=>setFilter(e.target.value)}>
    <option value="all">{en?"All statuses":"Все статусы"}</option>
    <option value="sent">{en?"Accepted":"Принято"}</option><option value="failed">{en?"Failed":"Ошибка"}</option>
    <option value="pending">{en?"Pending":"В очереди"}</option><option value="sending">{en?"Sending":"Отправляется"}</option>
   </select>
  </div>
  {error&&<p role="alert" className="mt-4 rounded-lg bg-red-100 p-3 text-red-900">{error}</p>}
  <p className="mt-4 text-sm">{visible.length} {en?"records shown":"записей"} · {en?"* Historical BCC configuration; verify actual recipients and delivery in Resend. Future confirmations include an organiser copy for each customer email.":"* Исторические настройки скрытой копии. Фактическую отправку и доставку проверяйте в Resend. В будущих подтверждениях копия отправляется для каждого письма."}</p>
  <div className="mt-3 overflow-x-auto rounded-xl border border-black bg-white"><table className="w-full min-w-[850px] text-left text-sm">
   <thead className="bg-orange-100"><tr>{(en?["Recipient","Booking","Email type","Organiser copy","Last activity (NZ)","Status","Actions"]:["Получатель","Бронь","Тип письма","Копия организатору","Дата (НЗ)","Статус","Действия"]).map(t=><th className="p-3" key={t}>{t}</th>)}</tr></thead>
   <tbody>{visible.map(r=><tr className="border-t border-gray-200" key={r.booking_id+":"+r.guest_index}>
    <td className="p-3">{r.recipient_email}</td><td className="p-3 font-semibold">{r.bookings?.booking_reference??"—"}</td>
    <td className="p-3">{en?"Booking confirmation":"Подтверждение брони"}</td><td className="p-3">{r.guest_index===0?(en?"BCC configured*":"BCC предусмотрена*"):(en?"Not configured*":"Не предусмотрена*")}</td>
    <td className="p-3">{time(r.sent_at??r.last_attempt_at??r.bookings?.created_at??null)}</td>
    <td className="p-3">{status(r)}</td><td className="p-3"><button onClick={()=>setSelected(r)} className="underline">{en?"Details":"Детали"}</button>
    {r.status==="failed"&&!r.provider_message_id&&r.attempts<3&&<button disabled={Boolean(working)} onClick={()=>void retry(r)} className="ml-3 rounded bg-black px-3 py-2 font-semibold text-white disabled:opacity-50">{working===r.booking_id+":"+r.guest_index?"…":en?"Retry":"Повторить"}</button>}</td>
   </tr>)}</tbody>
  </table>{visible.length===0&&<p className="p-6 text-center">{busy?"…":en?"No email records found":"Писем не найдено"}</p>}</div>
  {selected&&<div role="dialog" aria-modal="true" aria-label={en?"Email details":"Детали письма"} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
   <div className="max-h-[90vh] w-full max-w-xl overflow-auto rounded-xl bg-white p-6">
    <div className="flex items-center justify-between"><h2 className="text-xl font-black">{en?"Email details":"Детали письма"}</h2><button className="font-bold underline" onClick={()=>setSelected(null)}>{en?"Close":"Закрыть"}</button></div>
    <dl className="mt-4 space-y-3 break-words">{[
     [en?"Recipient":"Получатель",selected.recipient_email],[en?"Reference":"Бронь",selected.bookings?.booking_reference??"—"],
     [en?"Status":"Статус",status(selected)],[en?"Attempts":"Попытки",String(selected.attempts)],
     [en?"Last attempt":"Последняя попытка",time(selected.last_attempt_at)],[en?"Provider acceptance":"Принято провайдером",time(selected.sent_at)],
     [en?"Organiser copy":"Копия организатору",organiserCopy(selected)],["Resend ID",selected.provider_message_id??"—"],[en?"Error":"Ошибка",selected.error_message??"—"]
    ].map(([k,v])=><div key={k}><dt className="text-xs font-bold uppercase text-gray-500">{k}</dt><dd>{v}</dd></div>)}</dl>
    <p className="mt-5 text-sm text-gray-600">{en?"Open Resend to inspect the original message content, attachments, delivery events or bounces.":"Откройте Resend, чтобы просмотреть содержание письма, вложения, доставку и возвраты."}</p>
    <a className="mt-3 inline-block font-semibold underline" href="https://resend.com/emails" target="_blank" rel="noopener noreferrer">{en?"Open Resend":"Открыть Resend"}</a>
   </div></div>}
 </section></main>;
}
