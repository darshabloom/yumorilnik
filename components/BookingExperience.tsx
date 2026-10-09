"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import CustomerVenueMap,{type PublicTable,type PublicStage} from "@/components/CustomerVenueMap";
import type {VenueFeature} from "@/components/VenueLines";

export type BookingTicket = {
 id:string; name:string; description:string|null; price_cents:number;
 currency:string; quantity_total:number|null; quantity_sold:number|null;show_remaining?:boolean;
};
export type BookingEvent = { slug:string;title:string;image_url:string|null;booking_image_url?:string|null;booking_image_fit?:string|null;booking_image_position_x?:number|null;booking_image_position_y?:number|null;banner_fit?:string|null;seating_mode?:string|null;table_booking_mode?:string|null;adult_seat_required?:boolean };
export default function BookingExperience({event,tickets,venue}:{event:BookingEvent;tickets:BookingTicket[];venue?:{tables:PublicTable[];features:VenueFeature[];stage:PublicStage|null}}) {
 const [quantities,setQuantities]=useState<Record<string,number>>({});
 const [mapSelections,setMapSelections]=useState<string[]>([]);
 const tableBooking=event.seating_mode==="tables"&&event.table_booking_mode==="whole_table";
 const seatingMode=tableBooking?"whole_table":"individual_seats";
 function toggleMapSelection(key:string){setMapSelections(old=>old.includes(key)?old.filter(item=>item!==key):[...old,key]);}
 const count=tickets.reduce((total,t)=>total+(quantities[t.id]??0),0);
 const ticketTotal=tickets.reduce((sum,t)=>sum+t.price_cents*(quantities[t.id]??0),0);
 const adultTicketCount=tickets.filter(t=>/adult|взросл/i.test(t.name)).reduce((sum,t)=>sum+(quantities[t.id]??0),0);
 const seatsStillNeeded=event.adult_seat_required&&event.seating_mode!=="general_admission"?Math.max(0,adultTicketCount-mapSelections.length):0;
 const seatTotal=!tableBooking?mapSelections.reduce((sum,key)=>sum+(venue?.tables.find(t=>t.id===key.split(":")[0])?.seat_price_cents??0),0):0;
 const missingSeatPrices=!tableBooking&&mapSelections.some(key=>venue?.tables.find(t=>t.id===key.split(":")[0])?.seat_price_cents==null);
 const seatCount=mapSelections.length;
 const seatOverage=!tableBooking&&event.seating_mode!=="general_admission"&&seatCount>count;
 const tableTotal=tableBooking?mapSelections.reduce((sum,key)=>sum+(venue?.tables.find(t=>t.id===key)?.table_price_cents??0),0):0;
 const total=ticketTotal+(tableBooking?tableTotal:seatTotal);
 const currency=tickets[0]?.currency?.toUpperCase()||"NZD";
 const format=useMemo(()=>new Intl.NumberFormat("en-NZ",{style:"currency",currency}),[currency]);
 const max=10;
 function adjust(ticket:BookingTicket,delta:number){
   const available=Math.max(0,(ticket.quantity_total??0)-(ticket.quantity_sold??0));
   setQuantities(prev=>({...prev,[ticket.id]:Math.max(0,Math.min(max,available,(prev[ticket.id]??0)+delta))}));
 }
 return <main className="min-h-screen bg-[#fffaf1] pb-36 text-black">
   <div className="relative bg-[#fffaf1]">
     {(event.booking_image_url||event.image_url)?<img src={event.booking_image_url||event.image_url||""} alt="" className="h-32 w-full sm:h-44 lg:h-48" style={{objectFit:event.booking_image_fit==="contain"?"contain":"cover",objectPosition:`${event.booking_image_position_x??50}% ${event.booking_image_position_y??50}%`}}/>:<div className="h-40 w-full bg-[#f5a047]/30"/>}
   </div>
   <div className="mx-auto w-full max-w-[1600px] px-3 py-5 sm:px-6 sm:py-7 lg:px-10">
     <Link href={`/events/${event.slug}`} className="text-sm font-bold underline">← Вернуться к мероприятию</Link>
     <h1 className="mt-3 text-2xl font-bold sm:text-3xl lg:text-4xl">{event.title}</h1>
     <div className="mt-6 flex flex-col gap-8">
       <section aria-labelledby="tickets-title" className="space-y-3">
         <h2 id="tickets-title" className="text-xl font-bold">Билеты</h2>
         {tickets.length===0?<p className="rounded-xl border border-black/15 bg-white p-5">Билеты пока не добавлены.</p>:<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{tickets.map(ticket=>{
            const quantity=quantities[ticket.id]??0;
            const remaining=Math.max(0,(ticket.quantity_total??0)-(ticket.quantity_sold??0));
            return <div key={ticket.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-black/15 bg-white px-4 py-3">
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold">{ticket.name}</h3>
                {ticket.description&&<p className="mt-1 text-sm text-gray-600">{ticket.description}</p>}
                <p className="mt-1 font-semibold">{format.format(ticket.price_cents/100)}</p>
                {remaining===0?<p className="text-sm text-red-700">Нет в наличии</p>:ticket.show_remaining&&<p className="mt-1 text-xs text-gray-600">Осталось билетов: {remaining}</p>}
              </div>
              <div className="flex items-center gap-2" aria-label={`Количество: ${ticket.name}`}>
                <button type="button" aria-label={`Уменьшить количество: ${ticket.name}`} disabled={quantity===0} onClick={()=>adjust(ticket,-1)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-black/40 text-xl disabled:opacity-30">−</button>
                <output className="w-5 text-center text-lg font-bold">{quantity}</output>
                <button type="button" aria-label={`Увеличить количество: ${ticket.name}`} disabled={quantity>=Math.min(max,remaining)} onClick={()=>adjust(ticket,1)} className="flex h-11 w-11 items-center justify-center rounded-lg border border-black text-2xl disabled:opacity-30">+</button>
              </div>
            </div>;
         })}</div>}
       </section>
       <section aria-labelledby="seating-title" className="min-w-0 space-y-4">
         {seatOverage&&<p role="status" className="rounded-lg border border-orange-300 bg-orange-50 px-4 py-3 text-sm">Выбрано мест больше, чем билетов. Уменьшите количество мест или добавьте билеты.</p>}
         {event.adult_seat_required&&event.seating_mode!=="general_admission"&&<p className="rounded-lg border border-[#f5a047] bg-[#fff2db] px-4 py-3 text-sm font-semibold">{seatsStillNeeded>0?`Для взрослых необходимо выбрать ещё ${seatsStillNeeded} мест(а).`:"Для каждого взрослого билета требуется отдельное место. Места для детей — по желанию."}</p>}
         <h2 id="seating-title" className="text-xl font-bold">{event.seating_mode==="general_admission"?"Вход без закреплённых мест":event.seating_mode==="tables"?(event.table_booking_mode==="individual_seats"?"Места за столами":"Бронирование столов"):"Рассадка"}</h2>
         {event.seating_mode!=="general_admission"&&venue&&(venue.tables.length>0||venue.features.length>0)?<CustomerVenueMap tables={venue.tables} features={venue.features} stage={venue.stage} mode={seatingMode} selectedKeys={mapSelections} onToggle={toggleMapSelection}/>:<div className="flex min-h-80 flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-black/20 bg-white p-6 text-center sm:min-h-[450px]">
            <div className="flex h-12 w-40 items-center justify-center rounded-lg bg-[#f5a047]/50 text-sm font-bold">Сцена</div>
            <div className="grid grid-cols-3 gap-6 opacity-35" aria-hidden="true">
              {Array.from({length:9},(_,i)=><div key={i} className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-black/50 bg-[#fff2db]">○</div>)}
            </div>
            <p className="max-w-sm font-semibold">{event.seating_mode==="general_admission"?"Выбор мест не требуется":event.seating_mode==="tables"?(event.table_booking_mode==="individual_seats"?"Выбор мест за столами скоро появится":"Выбор целых столов скоро появится"):"План зала скоро появится"}</p>
            <p className="max-w-sm text-sm text-gray-600">Схема выше — только иллюстрация, а не настоящая рассадка. Выбор конкретных мест пока недоступен.</p>
         </div>}
       </section>
     </div>
   </div>
   <div className="fixed inset-x-0 bottom-0 z-40 border-t border-black/20 bg-white px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] sm:px-8">
     <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
       <div><p className="text-xs font-semibold text-gray-600">{tableBooking?`${mapSelections.length} стол(ов) выбрано · предварительно`: `${count} билет(ов)`} {event.seating_mode==="general_admission"?" · Свободная посадка":!tableBooking?` · ${mapSelections.length} мест выбрано · предварительно`:""}</p><p className="text-sm text-gray-600">Билеты: {format.format(ticketTotal/100)} · Места: {missingSeatPrices?"Цена не указана":format.format((tableBooking?tableTotal:seatTotal)/100)}</p><p className="text-2xl font-black">{missingSeatPrices?"—":format.format(total/100)}</p><p className="text-[11px] text-gray-600">Не является бронированием</p></div>
       <button type="button" disabled title="Продажа и выбор мест станут доступны после настройки зала и оплаты" className="min-h-12 rounded-lg bg-black px-5 py-3 font-bold text-white opacity-45">Продолжить →</button>
     </div>
   </div>
 </main>;
}
