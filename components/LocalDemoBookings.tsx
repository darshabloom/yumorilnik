"use client";

import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {useSiteLanguage} from "@/lib/useSiteLanguage";
import type {DemoBooking} from "@/lib/localDemoBookings";

export default function LocalDemoBookings(){
 const en=useSiteLanguage()==="en";
 const [bookings,setBookings]=useState<DemoBooking[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [message,setMessage]=useState("");
 const [search,setSearch]=useState("");
 const [showCancelled,setShowCancelled]=useState(false);
 const [expanded,setExpanded]=useState<string|null>(null);
 const [busy,setBusy]=useState<string|null>(null);
 async function load(){
  const response=await fetch("/api/dev/bookings",{cache:"no-store"});
  const result=await response.json() as {bookings?:DemoBooking[];error?:string};
  if(!response.ok||!result.bookings)throw new Error(result.error??"Unable to load test bookings");
  setBookings(result.bookings);
 }
 useEffect(()=>{
  let alive=true;
  void fetch("/api/dev/bookings",{cache:"no-store"}).then(async response=>{
   const result=await response.json() as {bookings?:DemoBooking[];error?:string};
   if(!response.ok||!result.bookings)throw new Error(result.error??"Unable to load test bookings");
   if(alive)setBookings(result.bookings);
  }).catch(err=>{if(alive)setError(err instanceof Error?err.message:"Unable to load bookings");})
  .finally(()=>{if(alive)setLoading(false)});
  return()=>{alive=false};
 },[]);
 const visible=useMemo(()=>bookings.filter(b=>{
  if(!showCancelled&&b.status==="cancelled")return false;
  const term=search.trim().toLowerCase();
  return !term||[b.reference,b.eventTitle,
   ...b.guests.flatMap(g=>[g.name,g.email??"",g.phone??""])]
   .some(v=>v.toLowerCase().includes(term));
 }),[bookings,showCancelled,search]);
 const money=(cents:number|null,currency:string)=>{
  if(cents===null)return en?"Price pending":"Цена уточняется";
  try{return new Intl.NumberFormat("en-NZ",{style:"currency",currency:currency||"NZD"}).format(cents/100)}
  catch{return (cents/100).toFixed(2)+" NZD"}
 };
 async function change(booking:DemoBooking,action:"cancel"|"delete"){
  const label=action==="delete"
   ?(en?"PERMANENTLY DELETE this fictional test booking from your computer?":"НАВСЕГДА удалить эту вымышленную тестовую заявку с компьютера?")
   :(en?"Cancel this fictional test booking? It will remain in the history.":"Отменить эту тестовую заявку? Она останется в истории.");
  if(!window.confirm(label))return;
  setBusy(booking.id);setError("");setMessage("");
  try{
   const response=await fetch("/api/dev/bookings",{method:"PATCH",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({id:booking.id,action}),
   });
   const result=await response.json() as {ok?:boolean;error?:string};
   if(!response.ok||!result.ok)throw new Error(result.error??"Update failed");
   await load();
   if(action==="delete")setExpanded(null);
   setMessage(action==="delete"
    ?(en?"Fictional booking deleted.":"Тестовая заявка удалена.")
    :(en?"Fictional booking cancelled.":"Тестовая заявка отменена."));
  }catch(err){setError(err instanceof Error?err.message:"Update failed");}
  finally{setBusy(null)}
 }
 return <main className="min-h-screen bg-[#fff2db] px-4 py-8 text-black sm:px-8">
  <div className="mx-auto max-w-5xl space-y-5">
   <Link href="/admin" className="text-sm font-semibold underline">{en?"← Admin dashboard":"← Панель управления"}</Link>
   <div>
    <h1 className="mt-4 text-3xl font-black">{en?"Fictional test bookings":"Вымышленные тестовые заявки"}</h1>
    <p className="mt-3 rounded-xl border-2 border-amber-500 bg-amber-50 p-4 text-sm">
     <strong>{en?"LOCAL TEST DATA — NOT REAL BOOKINGS":"ЛОКАЛЬНЫЕ ТЕСТЫ — НЕ НАСТОЯЩИЕ БРОНИ"}</strong>
     <span className="mt-1 block">{en?"These bookings are stored only on this computer while Next.js runs in development mode. They are not in Supabase, they do not hold seats, and they cannot admit anyone. Use fictional names and contact details only.":"Эти заявки хранятся только на этом компьютере при локальном запуске Next.js. Они не в Supabase, не закрепляют места и не дают права входа. Используйте только вымышленные имена и контакты."}</span>
    </p>
   </div>
   {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
   {message&&<p role="status" className="rounded-lg bg-green-50 p-3 text-green-900">{message}</p>}
   <div className="flex flex-wrap items-end gap-3 rounded-xl border border-black/10 bg-white p-4">
    <label className="min-w-[200px] flex-1 text-sm font-semibold">{en?"Search reference, event, guest or contact":"Поиск по номеру, мероприятию, гостю или контакту"}
     <input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder={en?"Search test bookings":"Поиск тестовых заявок"} className="mt-2 h-12 w-full rounded-lg border border-black/30 px-3 text-base"/>
    </label>
    <label className="flex min-h-12 items-center gap-2 text-sm"><input type="checkbox" checked={showCancelled} onChange={e=>setShowCancelled(e.target.checked)} className="h-5 w-5"/>{en?"Show cancelled":"Показать отменённые"}</label>
    <button type="button" onClick={()=>{setLoading(true);setError("");void load().catch(err=>setError(err instanceof Error?err.message:"Unable to refresh")).finally(()=>setLoading(false))}} className="h-12 rounded-lg border border-black px-4 font-semibold">{en?"Refresh":"Обновить"}</button>
   </div>
   <p className="text-sm font-semibold">{visible.length} {en?"fictional bookings":"тестовых заявок"}</p>
   {loading?<p role="status">{en?"Loading…":"Загрузка…"}</p>
    :visible.length===0?<p className="rounded-xl bg-white p-6">{en?"No matching test bookings yet. Complete a fictional booking on an event page and select Save test booking.":"Тестовых заявок пока нет. Заполните заявку вымышленными данными и нажмите «Сохранить тестовую заявку»."}</p>
    :<div className="grid gap-3">{visible.map(b=>{
      const adults=b.guests.filter(g=>g.category==="adult").length;
      const children=b.guests.filter(g=>g.category==="child").length;
      return <article key={b.id} className="rounded-xl border border-black/15 bg-white p-4 sm:p-6">
       <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
         <h2 className="font-mono text-lg font-bold">{b.reference}</h2>
         <p className="mt-1 font-semibold">{b.eventTitle}</p>
         <p className="mt-1 text-sm text-gray-600">{adults} {en?"adults":"взрослых"} · {children} {en?"children":"детей"} · {new Date(b.createdAt).toLocaleString(en?"en-NZ":"ru-RU")}</p>
         <p className={b.status==="cancelled"?"mt-1 text-sm font-bold text-red-700":"mt-1 text-sm font-semibold text-amber-800"}>{b.status==="cancelled"?(en?"Cancelled":"Отменена"):(en?"Test request · no reservation":"Тестовая заявка · не бронь")}</p>
        </div>
        <p className="text-xl font-black">{money(b.totalCents,b.currency)}</p>
       </div>
       <button type="button" onClick={()=>setExpanded(expanded===b.id?null:b.id)} className="mt-4 min-h-11 rounded-lg border border-black px-4 font-semibold">{expanded===b.id?(en?"Hide details":"Скрыть детали"):(en?"View guests and selected places":"Гости и выбранные места")}</button>
       {expanded===b.id&&<div className="mt-5 space-y-4 border-t border-black/15 pt-5">
        <section>
         <h3 className="font-bold">{en?"Ticket quantities":"Количество билетов"}</h3>
         {b.tickets.map((t,i)=><p key={i} className="mt-1 text-sm">{t.name} × {t.quantity} · {money(t.admissionCents*t.quantity,b.currency)}</p>)}
        </section>
        <section>
         <h3 className="font-bold">{en?"Named attendees":"Имена гостей"}</h3>
         <div className="mt-2 grid gap-3 sm:grid-cols-2">{b.guests.map(g=>{
          const seat=b.selections.find(s=>s.guestIndex===g.guestIndex);
          const parent=b.guests.find(p=>p.guestIndex===g.parentIndex);
          return <div key={g.guestIndex} className="rounded-lg border border-black/20 p-3">
           <p className="font-bold">{g.name} · {g.category==="adult"?(en?"Adult":"Взрослый"):(en?"Child":"Ребёнок")}</p>
           {g.email&&<p className="break-all text-sm">{en?"Email":"Почта"}: {g.email}</p>}
           {g.phone&&<p className="text-sm">{en?"Phone":"Телефон"}: {g.phone}</p>}
           {parent&&<p className="text-sm">{en?"Accompanying adult":"Сопровождающий взрослый"}: {parent.name}</p>}
           <p className="mt-2 text-sm">{seat?`${seat.tableLabel} · ${en?"Seat":"Место"} ${seat.seatNumber}`:g.category==="child"?(en?"Spare child seating at venue":"Дополнительное место для ребёнка на мероприятии"):(en?"Whole table / no individual seat":"Целый стол / без отдельного места")}</p>
          </div>;
         })}</div>
        </section>
        <section>
         <h3 className="font-bold">{en?"Selected places":"Выбранные места"}</h3>
         {b.selections.length===0?<p className="text-sm">{en?"General admission, no selected table places":"Вход без выбора мест"}</p>
          :b.selections.map((seat,i)=><p key={i} className="mt-1 text-sm">{seat.tableLabel}{seat.seatNumber!==null?` · ${en?"Seat":"Место"} ${seat.seatNumber}`:""} · {money(seat.priceCents,b.currency)}</p>)}
        </section>
        <div className="flex flex-wrap gap-2">
         {b.status==="requested"&&<button type="button" disabled={busy===b.id} onClick={()=>void change(b,"cancel")} className="min-h-11 rounded-lg border border-amber-700 px-4 font-semibold text-amber-900 disabled:opacity-40">{en?"Cancel test request":"Отменить тестовую заявку"}</button>}
         <button type="button" disabled={busy===b.id} onClick={()=>void change(b,"delete")} className="min-h-11 rounded-lg border border-red-700 px-4 font-semibold text-red-800 disabled:opacity-40">{en?"Permanently delete test record":"Навсегда удалить тестовую запись"}</button>
        </div>
       </div>}
      </article>;
    })}</div>}
  </div>
 </main>;
}
