"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

export type BookingTicket = {
 id:string; name:string; description:string|null; price_cents:number;
 currency:string; quantity_total:number|null; quantity_sold:number|null;
};
export type BookingEvent = { slug:string;title:string;image_url:string|null;banner_fit?:string|null };
export default function BookingExperience({event,tickets}:{event:BookingEvent;tickets:BookingTicket[]}) {
 const [quantities,setQuantities]=useState<Record<string,number>>({});
 const count=tickets.reduce((total,t)=>total+(quantities[t.id]??0),0);
 const total=tickets.reduce((sum,t)=>sum+t.price_cents*(quantities[t.id]??0),0);
 const currency=tickets[0]?.currency?.toUpperCase()||"NZD";
 const format=useMemo(()=>new Intl.NumberFormat("en-NZ",{style:"currency",currency}),[currency]);
 const max=10;
 function adjust(ticket:BookingTicket,delta:number){
   const available=Math.max(0,(ticket.quantity_total??0)-(ticket.quantity_sold??0));
   setQuantities(prev=>({...prev,[ticket.id]:Math.max(0,Math.min(max,available,(prev[ticket.id]??0)+delta))}));
 }
 return <main className="min-h-screen bg-[#fffaf1] pb-36 text-black">
   <div className="relative bg-[#fffaf1]">
     {event.image_url?<img src={event.image_url} alt="" className="h-44 w-full object-cover sm:h-64 lg:h-72"/>:<div className="h-40 w-full bg-[#f5a047]/30"/>}
   </div>
   <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
     <Link href={`/events/${event.slug}`} className="text-sm font-bold underline">← Вернуться к мероприятию</Link>
     <h1 className="mt-5 text-3xl font-black sm:text-5xl">{event.title}</h1>
     <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
       <section aria-labelledby="tickets-title" className="space-y-5">
         <h2 id="tickets-title" className="text-2xl font-black">Билеты</h2>
         {tickets.length===0?<p className="rounded-xl border border-black/15 bg-white p-5">Билеты пока не добавлены.</p>:tickets.map(ticket=>{
            const quantity=quantities[ticket.id]??0;
            const remaining=Math.max(0,(ticket.quantity_total??0)-(ticket.quantity_sold??0));
            return <div key={ticket.id} className="flex flex-wrap items-center justify-between gap-4 border-b border-black/15 pb-5">
              <div className="min-w-40 flex-1">
                <h3 className="text-lg font-bold">{ticket.name}</h3>
                {ticket.description&&<p className="mt-1 text-sm text-gray-600">{ticket.description}</p>}
                <p className="mt-1 font-semibold">{format.format(ticket.price_cents/100)}</p>
                {remaining===0&&<p className="text-sm text-red-700">Нет в наличии</p>}
              </div>
              <div className="flex items-center gap-3" aria-label={`Количество: ${ticket.name}`}>
                <button type="button" aria-label={`Уменьшить количество: ${ticket.name}`} disabled={quantity===0} onClick={()=>adjust(ticket,-1)} className="flex h-11 w-11 items-center justify-center rounded-lg border border-black text-2xl disabled:opacity-30">−</button>
                <output className="w-5 text-center text-lg font-bold">{quantity}</output>
                <button type="button" aria-label={`Увеличить количество: ${ticket.name}`} disabled={quantity>=Math.min(max,remaining)} onClick={()=>adjust(ticket,1)} className="flex h-11 w-11 items-center justify-center rounded-lg border border-black text-2xl disabled:opacity-30">+</button>
              </div>
            </div>;
         })}
       </section>
       <section aria-labelledby="seating-title" className="space-y-4">
         <h2 id="seating-title" className="text-2xl font-black">Рассадка</h2>
         <div className="flex min-h-80 flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-black/20 bg-white p-6 text-center sm:min-h-[450px]">
            <div className="flex h-12 w-40 items-center justify-center rounded-lg bg-[#f5a047]/50 text-sm font-bold">Сцена</div>
            <div className="grid grid-cols-3 gap-6 opacity-35" aria-hidden="true">
              {Array.from({length:9},(_,i)=><div key={i} className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-black/50 bg-[#fff2db]">○</div>)}
            </div>
            <p className="max-w-sm font-semibold">План зала скоро появится</p>
            <p className="max-w-sm text-sm text-gray-600">Схема выше — только иллюстрация, а не настоящая рассадка. Выбор конкретных мест пока недоступен.</p>
         </div>
       </section>
     </div>
   </div>
   <div className="fixed inset-x-0 bottom-0 z-40 border-t border-black/20 bg-white px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] sm:px-8">
     <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
       <div><p className="text-xs font-semibold text-gray-600">{count} {count===1?"билет":"билетов"} · 0 из {count} мест выбрано</p><p className="text-2xl font-black">{format.format(total/100)}</p></div>
       <button type="button" disabled title="Продажа и выбор мест станут доступны после настройки зала и оплаты" className="min-h-12 rounded-lg bg-black px-5 py-3 font-bold text-white opacity-45">Продолжить →</button>
     </div>
   </div>
 </main>;
}
