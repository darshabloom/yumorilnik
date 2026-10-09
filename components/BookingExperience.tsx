"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {useSiteLanguage} from "@/lib/useSiteLanguage";
import {zoneForTable,type PriceZone} from "@/lib/priceZones";
import CustomerVenueMap,{type PublicTable,type PublicStage} from "@/components/CustomerVenueMap";
import type {VenueFeature} from "@/components/VenueLines";

export type BookingTicket = {
 id:string; name:string; description:string|null; price_cents:number;
 currency:string; quantity_total:number|null; quantity_sold:number|null;show_remaining?:boolean;
};
export type BookingEvent = { slug:string;title:string;title_en?:string|null;image_url:string|null;booking_image_url?:string|null;booking_image_fit?:string|null;booking_image_position_x?:number|null;booking_image_position_y?:number|null;banner_fit?:string|null;seating_mode?:string|null;table_booking_mode?:string|null;adult_seat_required?:boolean;pricing_model?:string;child_unseated_price_cents?:number };
export default function BookingExperience({event,tickets,venue}:{event:BookingEvent;tickets:BookingTicket[];venue?:{zones:PriceZone[];tables:PublicTable[];features:VenueFeature[];stage:PublicStage|null}}) {
 const [quantities,setQuantities]=useState<Record<string,number>>({});
 const [mapSelections,setMapSelections]=useState<string[]>([]);
 const [step,setStep]=useState<"tickets"|"seats"|"review"|"guests">("tickets");
 const [seatLimitNotice,setSeatLimitNotice]=useState(false);
 const [guestInfo,setGuestInfo]=useState<Record<string,{name:string;email:string;phone:string}>>({});
 const language=useSiteLanguage();
 const en=language==="en";
 const tableBooking=event.seating_mode==="tables"&&event.table_booking_mode==="whole_table";
 const zonePricing=event.pricing_model==="zone_full_seat"&&!tableBooking&&event.seating_mode!=="general_admission";
 const seatingMode=tableBooking?"whole_table":"individual_seats";
 function toggleMapSelection(key:string){if(!tableBooking&&!mapSelections.includes(key)&&mapSelections.length>=adultTicketCount+(zonePricing?childTicketCount:0)){setSeatLimitNotice(true);return;}setSeatLimitNotice(false);setMapSelections(old=>old.includes(key)?old.filter(item=>item!==key):[...old,key]);}
 const count=tickets.reduce((total,t)=>total+(quantities[t.id]??0),0);
 const ticketTotal=tickets.reduce((sum,t)=>sum+(zonePricing&&/adult|взросл/i.test(t.name)?0:t.price_cents*(quantities[t.id]??0)),0);
 const adultTicketCount=tickets.filter(t=>/adult|взросл/i.test(t.name)).reduce((sum,t)=>sum+(quantities[t.id]??0),0);
 const childTicketCount=tickets.filter(t=>/child|детск|ребён|ребен/i.test(t.name)).reduce((sum,t)=>sum+(quantities[t.id]??0),0);
 const seatsStillNeeded=(zonePricing||event.adult_seat_required)&&event.seating_mode!=="general_admission"?Math.max(0,adultTicketCount-mapSelections.length):0;
 const selectedSeatPrice=(key:string)=>{const table=venue?.tables.find(t=>t.id===key.split(":")[0]);return table?(zonePricing?zoneForTable(table,venue?.zones??[])?.price_cents??null:table.seat_price_cents):null;};
 const seatTotal=!tableBooking?mapSelections.reduce((sum,key)=>sum+(selectedSeatPrice(key)??0),0):0;
 const missingSeatPrices=!tableBooking&&mapSelections.some(key=>selectedSeatPrice(key)==null);
 const seatCount=mapSelections.length;
 const seatOverage=!tableBooking&&event.seating_mode!=="general_admission"&&seatCount>adultTicketCount+(zonePricing?childTicketCount:0);
 const invalidTablePrices=tableBooking&&mapSelections.some(key=>venue?.tables.find(t=>t.id===key)?.table_price_cents==null);
 const canReview=count>0&&!seatOverage&&seatsStillNeeded===0&&(!tableBooking||mapSelections.length>0);
 const pricingIncomplete=missingSeatPrices||invalidTablePrices;
 const selections=mapSelections.map(key=>{
  const table=venue?.tables.find(t=>t.id===(tableBooking?key:key.split(":")[0]));
  return {key,label:table?.label??(en?"Table":"Стол"),seat:tableBooking?null:key.split(":")[1],cost:tableBooking?table?.table_price_cents:selectedSeatPrice(key)};
 });
 const tableTotal=tableBooking?mapSelections.reduce((sum,key)=>sum+(venue?.tables.find(t=>t.id===key)?.table_price_cents??0),0):0;
 const total=ticketTotal+(tableBooking?tableTotal:seatTotal);
 const currency=tickets[0]?.currency?.toUpperCase()||"NZD";
 const format=useMemo(()=>new Intl.NumberFormat("en-NZ",{style:"currency",currency}),[currency]);
 const max=10;
 const needsSeats=event.seating_mode!=="general_admission";
 const canContinueTickets=count>0;
 function adjust(ticket:BookingTicket,delta:number){
   const available=Math.max(0,(ticket.quantity_total??0)-(ticket.quantity_sold??0));
   setQuantities(prev=>({...prev,[ticket.id]:Math.max(0,Math.min(max,available,(prev[ticket.id]??0)+delta))}));
 }
 return <main className="min-h-screen bg-[#fffaf1] pb-36 text-black">
   <div className="relative bg-[#fffaf1]">
     {(event.booking_image_url||event.image_url)?<img src={event.booking_image_url||event.image_url||""} alt="" className="h-32 w-full sm:h-44 lg:h-48" style={{objectFit:event.booking_image_fit==="contain"?"contain":"cover",objectPosition:`${event.booking_image_position_x??50}% ${event.booking_image_position_y??50}%`}}/>:<div className="h-40 w-full bg-[#f5a047]/30"/>}
   </div>
   <div className="mx-auto w-full max-w-[1600px] px-3 py-5 sm:px-6 sm:py-7 lg:px-10">
     <Link href={`/events/${event.slug}`} className="text-sm font-bold underline">{en?"← Back to event":"← Вернуться к мероприятию"}</Link>
     <h1 className="mt-3 text-2xl font-bold sm:text-3xl lg:text-4xl">{en&&event.title_en?event.title_en:event.title}</h1>
     <div className="mt-5 flex flex-wrap items-center gap-2 text-xs font-semibold sm:text-sm">{([{id:"tickets",en:"1 · Tickets",ru:"1 · Билеты"},{id:"seats",en:"2 · Seats",ru:"2 · Места"},{id:"review",en:"3 · Review",ru:"3 · Проверка"},{id:"guests",en:"4 · Guests",ru:"4 · Гости"}] as const).filter(s=>needsSeats||s.id!=="seats").map(s=><span key={s.id} className={`rounded-full border px-3 py-2 ${step===s.id?"border-black bg-black text-white":"border-black/15 bg-white text-gray-600"}`}>{en?s.en:s.ru}</span>)}</div>
     {step==="guests"?<section className="mx-auto mt-7 w-full max-w-3xl space-y-5 rounded-2xl border border-black/15 bg-white p-5 sm:p-8">
       <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-bold">{en?"Guest details":"Данные гостей"}</h2><button type="button" className="text-sm underline" onClick={()=>{setStep("review")}}>{en?"← Back to review":"← К заказу"}</button></div>
       <p className="text-sm text-gray-600">{en?"Enter each adult's name. Email and phone are optional. This is a local preview: nothing is submitted or stored.":"Укажите имя каждого взрослого. Телефон и email необязательны. Это только предварительный просмотр: данные не отправляются и не сохраняются."}</p>
       {Array.from({length:adultTicketCount},(_,i)=>{
         const key=String(i),guest=guestInfo[key]??{name:"",email:"",phone:""};
         const update=(field:"name"|"email"|"phone",value:string)=>setGuestInfo(old=>({...old,[key]:{...(old[key]??{name:"",email:"",phone:""}),[field]:value}}));
         return <fieldset key={key} className="space-y-3 rounded-xl border border-black/15 p-4"><legend className="px-2 font-semibold">{en?"Adult":"Взрослый"} {i+1}</legend>
           <label className="block text-sm font-semibold">{en?"Full name":"Имя и фамилия"} *<input autoComplete="off" type="text" value={guest.name} onChange={e=>update("name",e.target.value)} className="mt-1 block w-full rounded-lg border border-black/30 p-3"/></label>
           <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm font-semibold">{en?"Email (optional)":"Email (необязательно)"}<input type="email" value={guest.email} onChange={e=>update("email",e.target.value)} className="mt-1 block w-full rounded-lg border border-black/30 p-3"/></label>
           <label className="block text-sm font-semibold">{en?"Phone (optional)":"Телефон (необязательно)"}<input type="tel" value={guest.phone} onChange={e=>update("phone",e.target.value)} className="mt-1 block w-full rounded-lg border border-black/30 p-3"/></label></div>
         </fieldset>;
       })}
       <p className="rounded-lg bg-[#fff2db] p-4 text-sm">{en?"Booking confirmation and guest-data submission are not yet enabled.":"Подтверждение бронирования и отправка данных гостей пока недоступны."}</p>
       <button type="button" onClick={()=>{setStep("review")}} className="w-full rounded-lg border border-black/30 px-5 py-3 font-semibold">{en?"Back to review":"Вернуться к заказу"}</button>
     </section>:step==="review"?<section className="mx-auto mt-7 w-full max-w-3xl space-y-5 rounded-2xl border border-black/15 bg-white p-5 sm:p-8" aria-label={en?"Order review":"Проверка заказа"}>
       <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-bold">{en?"Review your selection":"Проверьте ваш выбор"}</h2><button type="button" onClick={()=>setStep("seats")} className="text-sm font-semibold underline">{en?"← Edit":"← Изменить"}</button></div>
       <div><h3 className="mb-2 font-semibold">{en?"Admission tickets":"Входные билеты"}</h3>{tickets.filter(t=>(quantities[t.id]??0)>0).map(t=><div key={t.id} className="flex justify-between gap-3 border-b border-black/10 py-2 text-sm"><span>{t.name} × {quantities[t.id]}</span><span>{zonePricing&&/adult|взросл/i.test(t.name)?(en?"Included in seat prices":"Включено в стоимость мест"):format.format(t.price_cents*(quantities[t.id]??0)/100)}</span></div>)}</div>
       {event.seating_mode!=="general_admission"&&<div><h3 className="mb-2 font-semibold">{tableBooking?(en?"Selected tables":"Выбранные столы"):(en?"Selected seats":"Выбранные места")}</h3>{selections.length===0?<p className="text-sm text-gray-600">{en?"No seats selected":"Места не выбраны"}</p>:selections.map(s=><div key={s.key} className="flex justify-between gap-3 border-b border-black/10 py-2 text-sm"><span>{s.label}{s.seat?` · ${en?"seat":"место"} ${s.seat}`:""}</span><span>{s.cost==null?(en?"Price not set":"Цена не указана"):format.format(s.cost/100)}</span></div>)}</div>}
       <div className="space-y-1 border-t border-black/20 pt-4"><div className="flex justify-between text-sm"><span>{en?"Tickets":"Билеты"}</span><span>{format.format(ticketTotal/100)}</span></div><div className="flex justify-between text-sm"><span>{en?"Seats":"Места"}</span><span>{pricingIncomplete?(en?"Price pending":"Цена уточняется"):format.format((tableBooking?tableTotal:seatTotal)/100)}</span></div><div className="flex justify-between pt-2 text-lg font-bold"><span>{en?"Total":"Итого"}</span><span>{pricingIncomplete?(en?"Price pending":"Цена уточняется"):format.format(total/100)}</span></div></div>
       {pricingIncomplete&&<p role="status" className="rounded-lg border border-orange-300 bg-orange-50 p-4 text-sm">{en?"Some selected seats have not been priced by the organiser. The total will be available when prices are set.":"Для некоторых выбранных мест цена ещё не установлена организатором. Итоговая сумма будет известна после настройки цен."}</p>}
       <p className="rounded-lg bg-[#fff2db] p-4 text-sm">{en?"This is a preview only. Seats have not been reserved. Payment and order confirmation are not available yet.":"Это предварительный расчёт. Места не забронированы. Оплата и подтверждение заказа пока недоступны."}</p>
       <button type="button" onClick={()=>{setStep("guests");window.scrollTo({top:0,behavior:"smooth"})}} className="w-full rounded-lg bg-black px-5 py-3 font-semibold text-white">{en?"Enter guest details →":"Указать данные гостей →"}</button>
       <button type="button" onClick={()=>setReview(false)} className="w-full rounded-lg border border-black/30 px-5 py-3 font-semibold">{en?"Edit selection":"Изменить выбор"}</button>
     </section>:<div className="mt-6 flex flex-col gap-8">
       {step==="tickets"&&<section aria-labelledby="tickets-title" className="space-y-3">
         <h2 id="tickets-title" className="text-xl font-bold">{en?"How many tickets?":"Сколько билетов?"}</h2>
         <p className="text-sm text-gray-600">{en?"Choose the number of adults and children attending. You will choose seats on the next screen.":"Выберите количество взрослых и детей. Места можно будет выбрать на следующем экране."}</p>
         {tickets.length===0?<p className="rounded-xl border border-black/15 bg-white p-5">{en?"No tickets have been added yet.":"Билеты пока не добавлены."}</p>:<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{tickets.map(ticket=>{
            const quantity=quantities[ticket.id]??0;
            const remaining=Math.max(0,(ticket.quantity_total??0)-(ticket.quantity_sold??0));
            return <div key={ticket.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-black/15 bg-white px-4 py-3">
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold">{ticket.name}</h3>
                {ticket.description&&<p className="mt-1 text-sm text-gray-600">{ticket.description}</p>}
                <p className="mt-1 font-semibold">{zonePricing&&/adult|взросл/i.test(ticket.name)?(en?"Price set by selected seats":"Цена зависит от выбранных мест"):format.format(ticket.price_cents/100)}</p>
                {remaining===0?<p className="text-sm text-red-700">{en?"Sold out":"Нет в наличии"}</p>:ticket.show_remaining&&<p className="mt-1 text-xs text-gray-600">{en?"Tickets remaining: ":"Осталось билетов: "}{remaining}</p>}
              </div>
              <div className="flex items-center gap-2" aria-label={`${en?"Quantity":"Количество"}: ${ticket.name}`}>
                <button type="button" aria-label={`${en?"Decrease quantity":"Уменьшить количество"}: ${ticket.name}`} disabled={quantity===0} onClick={()=>adjust(ticket,-1)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-black/40 text-xl disabled:opacity-30">−</button>
                <output className="w-5 text-center text-lg font-bold">{quantity}</output>
                <button type="button" aria-label={`${en?"Increase quantity":"Увеличить количество"}: ${ticket.name}`} disabled={quantity>=Math.min(max,remaining)} onClick={()=>adjust(ticket,1)} className="flex h-11 w-11 items-center justify-center rounded-lg border border-black text-2xl disabled:opacity-30">+</button>
              </div>
            </div>;
         })}</div>}
       </section>}
       {step==="seats"&&<section aria-labelledby="seating-title" className="min-w-0 space-y-4">
         <button type="button" onClick={()=>setStep("tickets")} className="text-sm font-semibold underline">{en?"← Change ticket quantities":"← Изменить количество билетов"}</button>
         {seatLimitNotice&&<p role="status" className="rounded-lg border border-orange-300 bg-orange-50 px-4 py-3 text-sm">{en?"Select adults and children first. You can reserve one full-price seat per attendee.":"Сначала выберите взрослых и детей. На каждого гостя можно забронировать одно место по полной цене."}</p>}
         {seatOverage&&<p role="status" className="rounded-lg border border-orange-300 bg-orange-50 px-4 py-3 text-sm">{en?"More seats than attendees selected. Remove seats or add attendees.":"Выбрано больше мест, чем гостей. Уменьшите количество мест или добавьте билеты."}</p>}
         {event.adult_seat_required&&event.seating_mode!=="general_admission"&&<p className="rounded-lg border border-[#f5a047] bg-[#fff2db] px-4 py-3 text-sm font-semibold">{seatsStillNeeded>0?(en?`Select ${seatsStillNeeded} more seat(s) for adults.`:`Для взрослых необходимо выбрать ещё ${seatsStillNeeded} мест(а).`):(en?"Each adult ticket requires a reserved seat. Children’s seats are optional.":"Для каждого взрослого билета требуется отдельное место. Места для детей — по желанию.")}</p>}
         {zonePricing&&<p className="text-sm font-semibold">{en?"Please select your seats. Every adult needs one; child seats are optional and cost the full zone price.":"Пожалуйста, выберите места. Для каждого взрослого требуется место; детям места необязательны и стоят полную цену зоны."}</p>}
         <h2 id="seating-title" className="text-xl font-bold">{event.seating_mode==="general_admission"?(en?"General admission":"Вход без закреплённых мест"):event.seating_mode==="tables"?(event.table_booking_mode==="individual_seats"?(en?"Seats at tables":"Места за столами"):(en?"Whole-table booking":"Бронирование столов")):(en?"Seating":"Рассадка")}</h2>
         {event.seating_mode!=="general_admission"&&venue&&(venue.tables.length>0||venue.features.length>0)?<CustomerVenueMap tables={venue.tables} features={venue.features} stage={venue.stage} mode={seatingMode} selectedKeys={mapSelections} onToggle={toggleMapSelection} zones={zonePricing?venue.zones:[]} />:<div className="flex min-h-80 flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-black/20 bg-white p-6 text-center sm:min-h-[450px]">
            <div className="flex h-12 w-40 items-center justify-center rounded-lg bg-[#f5a047]/50 text-sm font-bold">{en?"Stage":"Сцена"}</div>
            <div className="grid grid-cols-3 gap-6 opacity-35" aria-hidden="true">
              {Array.from({length:9},(_,i)=><div key={i} className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-black/50 bg-[#fff2db]">○</div>)}
            </div>
            <p className="max-w-sm font-semibold">{event.seating_mode==="general_admission"?(en?"No reserved seat needed":"Выбор мест не требуется"):event.seating_mode==="tables"?(event.table_booking_mode==="individual_seats"?(en?"Seat selection will be available soon":"Выбор мест за столами скоро появится"):(en?"Table selection will be available soon":"Выбор целых столов скоро появится")):(en?"Venue map coming soon":"План зала скоро появится")}</p>
            <p className="max-w-sm text-sm text-gray-600">{en?"This is an illustration, not the real seating plan. Seat selection is not available yet.":"Схема выше — только иллюстрация, а не настоящая рассадка. Выбор конкретных мест пока недоступен."}</p>
         </div>}
       </section>}
     </div>}
   </div>
   <div className="fixed inset-x-0 bottom-0 z-40 border-t border-black/20 bg-white px-3 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] sm:px-8">
     <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
       <div className="min-w-0">
         <p className="text-[11px] font-semibold text-gray-600 sm:text-xs">{en?"Your receipt · Preview":"Ваш чек · Предпросмотр"}</p>
         <p className="text-xs text-gray-600">{en?"Adults":"Взрослые"}: {adultTicketCount} · {en?"Children":"Дети"}: {childTicketCount} · {en?"Seats":"Места"}: {mapSelections.length}</p>
         <p className="text-xs text-gray-600">{en?"Admission":"Вход"}: {format.format(ticketTotal/100)} · {en?"Reserved seats":"Места"}: {pricingIncomplete?(en?"Price pending":"Цена уточняется"):format.format((tableBooking?tableTotal:seatTotal)/100)}</p>
         <p className="text-xl font-black sm:text-2xl">{pricingIncomplete?(en?"Price pending":"Цена уточняется"):format.format(total/100)}</p>
       </div>
       {step==="tickets"?<button type="button" disabled={!canContinueTickets} onClick={()=>{setStep(needsSeats?"seats":"review");window.scrollTo({top:0,behavior:"smooth"})}} className="min-h-12 shrink-0 rounded-lg bg-black px-4 py-3 text-sm font-bold text-white disabled:opacity-45 sm:text-base">{needsSeats?(en?"Choose seats →":"Выбрать места →"):(en?"Review →":"Проверить →")}</button>:
        step==="seats"?<button type="button" disabled={!canReview} onClick={()=>{setStep("review");window.scrollTo({top:0,behavior:"smooth"})}} className="min-h-12 shrink-0 rounded-lg bg-black px-4 py-3 text-sm font-bold text-white disabled:opacity-45 sm:text-base">{en?"Review selection →":"Проверить выбор →"}</button>:
        <span className="max-w-40 text-right text-xs text-gray-500">{en?"Preview only · Not a reservation":"Предпросмотр · Не бронь"}</span>}
     </div>
   </div>
 </main>;
}
