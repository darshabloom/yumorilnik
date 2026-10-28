"use client";

import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {supabase} from "@/lib/supabaseClient";
import {useSiteLanguage} from "@/lib/useSiteLanguage";
import LocalDemoBookings from "@/components/LocalDemoBookings";

type Guest={id:string;guest_index:number;category:"adult"|"child";full_name:string;email:string|null;phone:string|null;accompanying_adult_index:number|null;guardian_index:number|null;is_child_with_adult_seat:boolean;childcare_hours:number|null;childcare_price_cents:number|null;checked_in_at:string|null};
type Item={id:string;ticket_name:string;category:string;quantity:number;unit_admission_cents:number};
type Selection={id:string;table_label:string;seat_number:number|null;guest_index:number|null;price_cents:number|null};
type EventSummary={title:string;title_en:string|null;event_date:string|null};
type BookingRow={
 id:string;event_id:string;booking_reference:string;status:"requested"|"confirmed"|"cancelled";
 created_at:string;cancelled_at:string|null;cancellation_reason:string|null;
 total_cents:number|null;currency:string;promo_code?:string|null;confirmation_email_status?:string|null;
 events:EventSummary|null;
 booking_items:Item[];booking_guests:Guest[];booking_selections:Selection[];
};

const money=(cents:number|null,currency:string,en:boolean)=>cents===null
 ?(en?"Price pending":"Цена уточняется")
 :new Intl.NumberFormat("en-NZ",{style:"currency",currency:currency||"NZD"}).format(cents/100);

export default function AdminBookingsPage(){
 if(process.env.NODE_ENV==="development"&&process.env.NEXT_PUBLIC_REAL_BOOKINGS_ENABLED!=="true")return <LocalDemoBookings/>;
 return <RealAdminBookingsPage/>;
}

function RealAdminBookingsPage(){
 const router=useRouter();
 const en=useSiteLanguage()==="en";
 const [allowed,setAllowed]=useState(false);
 const [loading,setLoading]=useState(true);
 const [bookings,setBookings]=useState<BookingRow[]>([]);
 const [selectedId,setSelectedId]=useState<string|null>(null);
 const [search,setSearch]=useState("");
 const [showCancelled,setShowCancelled]=useState(false);
 const [confirmingId,setConfirmingId]=useState<string|null>(null);
 const [reason,setReason]=useState("");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [message,setMessage]=useState("");

 async function load(){
  const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError||!user){router.replace("/admin/login");return;}
  const {data:membership,error:roleError}=await supabase.from("admin_users")
   .select("role").eq("user_id",user.id).maybeSingle();
  if(roleError||!membership||!["owner","admin"].includes(membership.role)){
   router.replace("/admin/login");return;
  }
  setAllowed(true);
  const {data,error:fetchError}=await supabase.from("bookings")
   .select("id,event_id,booking_reference,status,created_at,cancelled_at,cancellation_reason,total_cents,currency,promo_code,confirmation_email_status,events(title,title_en,event_date),booking_items(id,ticket_name,category,quantity,unit_admission_cents),booking_guests(id,guest_index,category,full_name,email,phone,accompanying_adult_index,guardian_index,is_child_with_adult_seat,childcare_hours,childcare_price_cents,checked_in_at),booking_selections(id,table_label,seat_number,guest_index,price_cents)")
   .order("created_at",{ascending:false}).limit(250);
  if(fetchError)throw fetchError;
  setBookings((data??[]) as unknown as BookingRow[]);
 }
 useEffect(()=>{
  let active=true;
  void (async()=>{try{await load()}catch(err){if(active)setError(err instanceof Error?err.message:"Unable to load bookings")}
   finally{if(active)setLoading(false)}
  })();
  return()=>{active=false};
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[router]);

 const visible=useMemo(()=>bookings.filter(booking=>{
  if(!showCancelled&&booking.status==="cancelled")return false;
  const q=search.trim().toLowerCase();
  if(!q)return true;
  return [booking.booking_reference,booking.events?.title??"",booking.events?.title_en??"",
   ...booking.booking_guests.flatMap(g=>[g.full_name,g.email??"",g.phone??""])]
   .some(value=>value.toLowerCase().includes(q));
 }),[bookings,search,showCancelled]);
 const selected=bookings.find(b=>b.id===selectedId)??null;

 async function cancelBooking(booking:BookingRow){
  setBusy(true);setError("");setMessage("");
  try{
   const {data,error:rpcError}=await supabase.rpc("cancel_booking",{
    p_booking_id:booking.id,p_reason:reason.trim()||null,
   });
   if(rpcError)throw rpcError;
   if(data!==true)throw new Error(en?"The request was already cancelled or missing.":"Заявка уже отменена или отсутствует.");
   setBookings(old=>old.map(row=>row.id===booking.id?{
    ...row,status:"cancelled" as const,cancelled_at:new Date().toISOString(),
    cancellation_reason:reason.trim()||null,
   }:row));
   setMessage(en?"Request cancelled and removed from the active list. An audit record is retained.":"Заявка отменена и удалена из активного списка. Запись сохранена для истории.");
   setConfirmingId(null);setReason("");
  }catch(err){setError(err instanceof Error?err.message:(en?"Cancellation failed.":"Не удалось отменить заявку."))}
  finally{setBusy(false)}
 }

 if(loading)return <main className="min-h-[65vh] bg-[#fff2db] p-6" role="status">{en?"Loading booking requests…":"Загрузка заявок…"}</main>;
 if(!allowed)return <main className="min-h-[65vh] bg-[#fff2db] p-6" role="alert">{error|| (en?"Checking access…":"Проверяем доступ…")}</main>;
 return <main className="min-h-screen bg-[#fff2db] px-4 py-8 text-black sm:px-8">
  <div className="mx-auto max-w-6xl space-y-5">
   <Link href="/admin" className="text-sm font-bold underline">{en?"← Admin dashboard":"← Панель управления"}</Link>
   <div>
    <h1 className="mt-3 text-3xl font-black">{en?"Booking requests":"Заявки на бронирование"}</h1>
    <p className="mt-2 max-w-4xl text-sm text-gray-700">{en?"These are customer requests, not confirmed reservations. No payments or tickets have been issued, and selected places are not held. Cancellation removes a request from the active list but retains its history.":"Это заявки клиентов, а не подтверждённые брони. Оплата не получена, билеты не выпущены, места не закреплены. Отмена убирает заявку из активного списка, но сохраняет историю."}</p>
   </div>
   {error&&<p role="alert" className="rounded-lg bg-red-100 p-4 text-red-800">{error}</p>}
   {message&&<p role="status" className="rounded-lg bg-green-100 p-4 text-green-900">{message}</p>}
   <div className="grid gap-3 rounded-xl border border-black/10 bg-white p-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
    <label className="block text-sm font-bold">{en?"Search reference, event, guest or contact":"Поиск по номеру, мероприятию, гостю или контакту"}
     <input value={search} onChange={e=>setSearch(e.target.value)} type="search" className="mt-2 h-12 w-full rounded-lg border border-black/30 px-3 text-base" placeholder={en?"Search bookings":"Поиск заявок"}/>
    </label>
    <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={showCancelled} onChange={e=>setShowCancelled(e.target.checked)} className="h-5 w-5"/>{en?"Show cancelled":"Показать отменённые"}</label>
    <button type="button" onClick={()=>{setLoading(true);setError("");void load().catch(err=>setError(err instanceof Error?err.message:"Unable to reload")).finally(()=>setLoading(false));}} className="min-h-12 rounded-lg border border-black px-4 font-semibold">{en?"Refresh":"Обновить"}</button>
   </div>
   <p className="text-sm text-gray-600">{visible.length} {en?"requests shown (latest 250 loaded)":"заявок показано (загружены последние 250)"}</p>
   {visible.length===0?<div className="rounded-xl bg-white p-8 text-center text-gray-700">{en?"No matching booking requests.":"Подходящих заявок нет."}</div>:<div className="grid gap-3">
    {visible.map(booking=>{
     const adults=booking.booking_guests.filter(g=>g.category==="adult").length;
     const children=booking.booking_guests.filter(g=>g.category==="child").length;
     const firstAdult=[...booking.booking_guests].sort((a,b)=>a.guest_index-b.guest_index).find(g=>g.category==="adult");
     return <article key={booking.id} className="rounded-xl border border-black/15 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
       <div className="min-w-0 space-y-1">
        <p className="font-mono text-lg font-bold">{booking.booking_reference}</p>
        <h2 className="font-semibold">{en&&booking.events?.title_en?booking.events.title_en:booking.events?.title??(en?"Event":"Мероприятие")}</h2>
        <p className="text-sm text-gray-700">{firstAdult?.full_name??""} · {adults} {en?"adults":"взрослых"} / {children} {en?"children":"детей"}</p>
        <p className="text-xs text-gray-600">{new Date(booking.created_at).toLocaleString(en?"en-NZ":"ru-RU")}</p>
       </div>
       <div className="text-right">
        <p className="text-lg font-black">{money(booking.total_cents,booking.currency,en)}</p>
        {booking.promo_code&&<p className="text-xs font-semibold">{en?"Promo":"Промокод"}: {booking.promo_code}</p>}
        {booking.confirmation_email_status&&booking.confirmation_email_status!=="not_queued"&&<p className="text-xs text-gray-700">{en?"Confirmation email":"Письмо с подтверждением"}: {booking.confirmation_email_status==="sent"?(en?"sent":"отправлено"):booking.confirmation_email_status==="failed"?(en?"failed":"ошибка"):(en?"pending":"ожидает отправки")}</p>}
        <p className={booking.status==="cancelled"?"text-sm font-semibold text-red-700":"text-sm font-semibold text-amber-700"}>{booking.status==="cancelled"?(en?"Cancelled":"Отменена"):booking.status==="confirmed"?(en?"Confirmed (free)":"Подтверждено (бесплатно)"):(en?"Awaiting review":"Ожидает проверки")}</p>
       </div>
      </div>
      <button type="button" className="mt-4 min-h-11 rounded-lg border border-black px-4 font-bold" onClick={()=>{setSelectedId(selectedId===booking.id?null:booking.id);setConfirmingId(null);setReason("");}}>{selectedId===booking.id?(en?"Hide details":"Скрыть детали"):(en?"View guests and seats":"Гости и места")}</button>
      {selectedId===booking.id&&<div className="mt-5 space-y-5 border-t border-black/15 pt-5">
       <section><h3 className="font-bold">{en?"Admission tickets":"Входные билеты"}</h3>
        {booking.booking_items.map(item=><p key={item.id} className="mt-2 text-sm">{item.ticket_name} × {item.quantity} · {money(item.unit_admission_cents*item.quantity,booking.currency,en)}</p>)}
       </section>
       <section><h3 className="font-bold">{en?"Named guests and contacts":"Гости и контакты"}</h3>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">{[...booking.booking_guests].sort((a,b)=>a.guest_index-b.guest_index).map(guest=>{
         const seat=booking.booking_selections.find(s=>s.guest_index===guest.guest_index);
         const parent=booking.booking_guests.find(g=>g.guest_index===(guest.guardian_index??guest.accompanying_adult_index));
         return <div key={guest.id} className="rounded-lg border border-black/15 p-3">
          <p className="font-bold">{guest.full_name} · {guest.is_child_with_adult_seat?(en?"Child · adult-priced table seat":"Ребёнок · место по взрослому тарифу"):guest.category==="adult"?(en?"Adult":"Взрослый"):(en?"Child":"Ребёнок")}</p>
          {guest.email&&<p className="break-all text-sm">{en?"Email":"Почта"}: {guest.email}</p>}
          {guest.phone&&<p className="text-sm">{en?"Phone":"Телефон"}: {guest.phone}</p>}
          {parent&&<p className="text-sm">{en?"Accompanying adult":"Сопровождающий взрослый"}: {parent.full_name}</p>}
          {guest.childcare_hours&&<p className="text-sm font-semibold">{en?"Childcare":"Присмотр"}: {guest.childcare_hours} {en?"hours":"часов"} · NZ${((guest.childcare_price_cents??0)/100).toFixed(2)}</p>}
          {guest.is_child_with_adult_seat&&<p className="text-sm font-semibold">{en?"Adult seat price only · childcare on the day":"Только место по взрослому тарифу · присмотр в день мероприятия"}</p>}
          <p className="mt-1 text-sm">{seat?`${seat.table_label} · ${en?"Seat":"Место"} ${seat.seat_number}`:(en?"No individually assigned seat":"Без отдельного закреплённого места")}</p>
         </div>;
        })}</div>
       </section>
       <section><h3 className="font-bold">{en?"Selected tables / places":"Выбранные столы / места"}</h3>
        {booking.booking_selections.length===0?<p className="text-sm text-gray-600">{en?"General admission, no reserved places":"Без закреплённых мест"}</p>:booking.booking_selections.map(s=><p key={s.id} className="mt-2 text-sm">{s.table_label}{s.seat_number!==null?` · ${en?"seat":"место"} ${s.seat_number}`:""} · {money(s.price_cents,booking.currency,en)}</p>)}
       </section>
       {booking.status==="cancelled"?<p className="rounded bg-red-50 p-3 text-sm">{en?"Cancelled":"Отменена"}: {booking.cancellation_reason??"—"}</p>:<div className="space-y-3">
        {confirmingId!==booking.id?<button type="button" onClick={()=>{setConfirmingId(booking.id);setReason("");}} className="min-h-11 rounded-lg border border-red-700 px-4 font-bold text-red-800">{en?"Cancel / remove from active list":"Отменить / убрать из активных"}</button>:<div className="max-w-xl rounded-lg border border-red-400 bg-red-50 p-4">
         <p className="text-sm font-semibold">{en?"This cancels the request; it cannot be undone here. The record remains for audit and privacy handling.":"Заявка будет отменена; восстановить её здесь нельзя. Запись останется для истории и обработки персональных данных."}</p>
         <label className="mt-3 block text-sm font-bold">{en?"Reason (optional)":"Причина (необязательно)"}<textarea value={reason} maxLength={500} rows={2} onChange={e=>setReason(e.target.value)} className="mt-2 w-full rounded border border-black/30 bg-white p-3"/></label>
         <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={()=>void cancelBooking(booking)} className="min-h-11 rounded-lg bg-red-800 px-4 font-bold text-white disabled:opacity-50">{en?"Confirm cancellation":"Подтвердить отмену"}</button>
          <button type="button" disabled={busy} onClick={()=>setConfirmingId(null)} className="min-h-11 rounded-lg border border-black px-4 font-bold">{en?"Keep request":"Оставить заявку"}</button>
         </div>
        </div>}
       </div>}
      </div>}
     </article>;
    })}
   </div>}
   {selected&&<p className="text-xs text-gray-600">{en?"Only Marina's authorised admins can view these personal details. Share them only when necessary to run the event.":"Персональные данные доступны только уполномоченным администраторам Марины. Не передавайте их без необходимости."}</p>}
  </div>
 </main>;
}
