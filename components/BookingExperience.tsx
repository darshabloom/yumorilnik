"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {NEW_YEARS_2026_EVENT_ID,childcarePriceCents} from "@/lib/newYearsBooking";
import {supabase} from "@/lib/supabaseClient";
import {buildBookingSubmission} from "@/lib/bookingSubmission";
import type {DemoBookingDraft} from "@/lib/localDemoBookings";
import Link from "next/link";
import {useSiteLanguage} from "@/lib/useSiteLanguage";
import type {PriceZone} from "@/lib/priceZones";
import CustomerVenueMap,{type PublicTable,type PublicStage} from "@/components/CustomerVenueMap";
import type {VenueFeature} from "@/components/VenueLines";
import {partyCounts,canStartBooking,guestValidationProblems,reservedAdultSeats,bookingTotalCents,classifyTicket,changeNamedSeat,selectedTableCapacity,bookingReadyForReview,tablePlacePriceCents,admissionTotalForEventCents} from "@/lib/bookingRules";

export type BookingTicket = {
 id:string; name:string; description:string|null; price_cents:number;
 currency:string; quantity_total:number|null; quantity_sold:number|null;show_remaining?:boolean;
};
export type BookingEvent = { id?:string;slug:string;title:string;title_en?:string|null;image_url:string|null;booking_image_url?:string|null;booking_image_fit?:string|null;booking_image_position_x?:number|null;booking_image_position_y?:number|null;banner_fit?:string|null;seating_mode?:string|null;table_booking_mode?:string|null;adult_seat_required?:boolean;pricing_model?:string;child_unseated_price_cents?:number };
export default function BookingExperience({event,tickets,venue}:{event:BookingEvent;tickets:BookingTicket[];venue?:{zones:PriceZone[];tables:PublicTable[];features:VenueFeature[];stage:PublicStage|null}}) {
 const [quantities,setQuantities]=useState<Record<string,number>>({});
 const [mapSelections,setMapSelections]=useState<string[]>([]);
 const [step,setStep]=useState<"tickets"|"guests"|"seats"|"review">("tickets");
 const [guestInfo,setGuestInfo]=useState<Record<string,{name:string;email:string;phone:string}>>({});
 const [guestErrors,setGuestErrors]=useState(false);
 const [childParents,setChildParents]=useState<Record<string,string>>({});
 const [adultSeatChildren,setAdultSeatChildren]=useState<Record<string,boolean>>({});
 const [childcareHours,setChildcareHours]=useState<Record<string,string>>({});
 const [accessChoice,setAccessChoice]=useState<"choose"|"guest"|"google">("choose");
 const [accessBusy,setAccessBusy]=useState(false);
 const [accessError,setAccessError]=useState("");
 const [seatAssignments,setSeatAssignments]=useState<Record<string,string>>({});
 const [activeSeatGuest,setActiveSeatGuest]=useState<string>("0");
 const [seatFeedback,setSeatFeedback]=useState("");
 const [savingBooking,setSavingBooking]=useState(false);
 const [bookingConsent,setBookingConsent]=useState(false);
 const [promoCode,setPromoCode]=useState("");
 const [savedStatus,setSavedStatus]=useState<"requested"|"confirmed"|null>(null);
 const [savedEmailStatus,setSavedEmailStatus]=useState<string|null>(null);
 const [marketingOptIn,setMarketingOptIn]=useState(false);
 const [marketingAdultIndex,setMarketingAdultIndex]=useState(0);
 const [marketingResult,setMarketingResult]=useState<"none"|"subscribed"|"not_subscribed"|"failed">("none");
 const [marketingBusy,setMarketingBusy]=useState(false);
 const [bookingError,setBookingError]=useState("");
 const [savedReference,setSavedReference]=useState<string|null>(null);
 const requestId=useRef<string|null>(null);
 const realBookingsEnabled=process.env.NEXT_PUBLIC_REAL_BOOKINGS_ENABLED==="true";
 const localTestMode=process.env.NODE_ENV==="development"&&!realBookingsEnabled;
 const requestsEnabled=localTestMode||realBookingsEnabled;
 const language=useSiteLanguage();
 const en=language==="en";
 const nyeChildcare=event.id===NEW_YEARS_2026_EVENT_ID;
 useEffect(()=>{
  let active=true;
  void supabase.auth.getUser().then(({data})=>{if(active&&data.user)setAccessChoice("google");}).catch(()=>{});
  return()=>{active=false};
 },[]);
 async function chooseGoogle(){
  setAccessBusy(true);setAccessError("");
  const {error}=await supabase.auth.signInWithOAuth({provider:"google",
   options:{redirectTo:`${window.location.origin}${window.location.pathname}`}});
  if(error){setAccessError(error.message);setAccessBusy(false);}
 }
 const tableBooking=event.seating_mode==="tables"&&event.table_booking_mode==="whole_table";
 const seatedPricing=event.seating_mode!=="general_admission";
 const seatingMode=tableBooking?"whole_table":"individual_seats";
 function toggleMapSelection(key:string){
   setSeatFeedback("");
   if(tableBooking){setMapSelections(old=>old.includes(key)?old.filter(item=>item!==key):[...old,key]);return;}
   const first=0;
   const limit=adultTicketCount;
   const result=changeNamedSeat(seatAssignments,key,Number(activeSeatGuest),adultTicketCount,childTicketCount,"seats");
   if(result.outcome==="occupied"){
     setSeatFeedback(en?"This seat belongs to another guest. Select their name to change it.":"Это место уже закреплено за другим гостем. Выберите его имя, чтобы изменить место.");
     return;
   }
   if(result.outcome==="invalid")return;
   setSeatAssignments(result.assignments);
   setMapSelections(Object.keys(result.assignments));
   if(result.outcome==="assigned"){
     const taken=new Set(Object.values(result.assignments));
     const nextGuest=Array.from({length:limit-first},(_,i)=>String(first+i)).find(id=>!taken.has(id));
     if(nextGuest)setActiveSeatGuest(nextGuest);
   }
 }
 const count=tickets.reduce((total,t)=>total+(quantities[t.id]??0),0);
 const party=partyCounts(tickets.map(t=>({name:t.name,quantity:quantities[t.id]??0})));
 const adultTicketCount=party.adults;
 const childTicketCount=party.children;
 const baseAdmissionTotal=admissionTotalForEventCents(event.seating_mode,tickets.map(t=>({name:t.name,price_cents:t.price_cents,quantity:quantities[t.id]??0})));
 const childBaseAdmission=tickets.filter(t=>classifyTicket(t.name)==="child").reduce((sum,t)=>sum+t.price_cents*(quantities[t.id]??0),0);
 const childHoursTotal=Array.from({length:childTicketCount},(_,i)=>childcarePriceCents(childcareHours[String(adultTicketCount+i)]==="6"?"6":"3")).reduce((sum,p)=>sum+p,0);
 const admissionTotal=baseAdmissionTotal===null?null:nyeChildcare?baseAdmissionTotal-childBaseAdmission+childHoursTotal:baseAdmissionTotal;
 const ticketTotal=admissionTotal??0;
 const seatsStillNeeded=!tableBooking&&seatedPricing?Math.max(0,adultTicketCount-reservedAdultSeats(adultTicketCount,seatAssignments)):0;
 const selectedSeatPrice=(key:string)=>{const table=venue?.tables.find(t=>t.id===key.split(":")[0]);return tablePlacePriceCents(table);};
 const seatTotal=!tableBooking?mapSelections.reduce((sum,key)=>sum+(selectedSeatPrice(key)??0),0):0;

 const seatOverage=!tableBooking&&event.seating_mode!=="general_admission"&&mapSelections.length>adultTicketCount;
 const guestProblems=guestValidationProblems(adultTicketCount,childTicketCount,guestInfo,childParents,
  {adultSeatChildren,childcareHours,requireChildcareHours:nyeChildcare});
 const guestDetailsComplete=guestProblems.length===0;
 const selectedPrices=mapSelections.map(key=>tableBooking?venue?.tables.find(t=>t.id===key)?.table_price_cents??null:selectedSeatPrice(key));
 const ticketPricesInvalid=admissionTotal===null;
 const calculatedTotal=ticketPricesInvalid?null:bookingTotalCents(ticketTotal,selectedPrices);
 const pricingIncomplete=calculatedTotal===null;
 const tableCapacity=tableBooking?selectedTableCapacity(mapSelections,venue?.tables??[]):0;
 const tableHasAdultCapacity=!tableBooking||tableCapacity>=adultTicketCount;
 const canReview=bookingReadyForReview({ticketCount:count,guestDetailsComplete,totalCents:calculatedTotal,generalAdmission:event.seating_mode==="general_admission",wholeTable:tableBooking,selectedCount:mapSelections.length,tableCapacity,adultCount:adultTicketCount,assignedAdultSeats:reservedAdultSeats(adultTicketCount,seatAssignments),adultSeatsRequired:seatedPricing,seatOverage});
 const selections=mapSelections.map(key=>{
  const table=venue?.tables.find(t=>t.id===(tableBooking?key:key.split(":")[0]));
  return {key,label:table?.label??(en?"Table":"Стол"),seat:tableBooking?null:key.split(":")[1],cost:tableBooking?table?.table_price_cents:selectedSeatPrice(key)};
 });
 const tablesWithoutPrices=Array.from(new Set(selections.filter(item=>item.cost===null||item.cost===undefined).map(item=>item.label)));
 const tableTotal=tableBooking?mapSelections.reduce((sum,key)=>sum+(venue?.tables.find(t=>t.id===key)?.table_price_cents??0),0):0;
 const total=calculatedTotal;
 const currency=tickets[0]?.currency?.toUpperCase()||"NZD";
 const format=useMemo(()=>new Intl.NumberFormat("en-NZ",{style:"currency",currency}),[currency]);
 const max=10;
 const needsSeats=event.seating_mode!=="general_admission";
 const canContinueTickets=canStartBooking(party)&&!ticketPricesInvalid;
 const adultSeats=reservedAdultSeats(adultTicketCount,seatAssignments);
 function adjust(ticket:BookingTicket,delta:number){
   const available=ticket.quantity_total==null?max:Math.max(0,ticket.quantity_total-(ticket.quantity_sold??0));
   const next=Math.max(0,Math.min(max,available,(quantities[ticket.id]??0)+delta));
   if(next===(quantities[ticket.id]??0))return;
   // Indexed guests and seats must not silently transfer when the party changes.
   setQuantities(prev=>({...prev,[ticket.id]:next}));
   setGuestInfo({});
   setChildParents({});
   setAdultSeatChildren({});
   setChildcareHours({});
   setGuestErrors(false);
   setMapSelections([]);
   setSeatAssignments({});
    setSeatFeedback("");
   setActiveSeatGuest("0");
 }
 const guestErrorLabel=(problem:{guestIndex:number;field:"name"|"email"|"phone"|"parent"|"duration"})=>{
  const isChild=problem.guestIndex>=adultTicketCount||adultSeatChildren[String(problem.guestIndex)]===true;
  const index=problem.guestIndex;
  const person=isChild?`${en?"Child":"Ребёнок"} ${index>=adultTicketCount?index-adultTicketCount+1:index+1}`:`${en?"Adult":"Взрослый"} ${index+1}`;
  const enteredName=guestInfo[String(index)]?.name.trim();
  const who=enteredName?`${person} (${enteredName})`:person;
  const message={
   name:en?"please enter a full name.":"укажите имя и фамилию.",
   email:en?"please enter a valid email address (e.g. name@example.com).":"укажите правильный email (например, name@example.com).",
   phone:en?"please enter a phone number.":"укажите номер телефона.",
   parent:en?"please select an accompanying adult who is not marked as a child.":"выберите сопровождающего взрослого, не отмеченного как ребёнок.",
   duration:en?"please choose 3 or 6 hours of childcare.":"выберите 3 или 6 часов присмотра.",
  }[problem.field];
  return `${who}: ${message}`;
 };
 function continueFromGuestInfo(){
  setGuestErrors(guestProblems.length>0);
  if(guestProblems.length>0){
   const first=guestProblems[0];
   document.querySelector<HTMLElement>(`[data-guest-index="${first.guestIndex}"][data-guest-field="${first.field}"]`)?.focus();
   return;
  }
  if(!needsSeats&&pricingIncomplete)return;
  setActiveSeatGuest("0");
  setStep(needsSeats?"seats":"review");
  window.scrollTo({top:0,behavior:"smooth"});
 }
 async function saveOptionalMarketingConsent(idempotency:string){
  setMarketingBusy(true);
  try{
   const {data,error}=await supabase.rpc("marketing_opt_in",{
    p_client_request_id:idempotency,p_adult_guest_index:marketingAdultIndex,
   });
   if(error)throw error;
   setMarketingResult(data===true?"subscribed":"not_subscribed");
  }catch{setMarketingResult("failed")}
  finally{setMarketingBusy(false)}
 }
 async function submitBookingRequest(){
  if(!requestsEnabled||(!localTestMode&&!event.id)||!canReview||!bookingConsent||savingBooking||savedReference||(!localTestMode&&promoCode.trim()!=="TEST12"))return;
  const idempotency=requestId.current??window.crypto.randomUUID();
  requestId.current=idempotency;
  setSavingBooking(true);setBookingError("");
  try{
   if(localTestMode){
    const draft:DemoBookingDraft={
     clientRequestId:idempotency,
     eventTitle:(en&&event.title_en?event.title_en:event.title),
     eventSlug:event.slug,currency,totalCents:total,
     tickets:tickets.filter(t=>(quantities[t.id]??0)>0).map(t=>({
      name:t.name,quantity:quantities[t.id]??0,
      admissionCents:seatedPricing&&classifyTicket(t.name)==="adult"?0:t.price_cents,
     })),
     guests:Array.from({length:adultTicketCount+childTicketCount},(_,i)=>{
      const guest=guestInfo[String(i)];
      return {
       guestIndex:i,category:i<adultTicketCount?"adult" as const:"child" as const,
       name:guest.name.trim(),email:i<adultTicketCount?guest.email.trim():null,
       phone:i<adultTicketCount?guest.phone.trim():null,
       parentIndex:i<adultTicketCount?null:Number(childParents[String(i)]),
      };
     }),
     selections:selections.map(selection=>({
      tableLabel:selection.label,seatNumber:selection.seat===null?null:Number(selection.seat),
      guestIndex:tableBooking?null:Number(seatAssignments[selection.key]),
      priceCents:selection.cost??null,
     })),
    };
    const response=await fetch("/api/dev/bookings",{method:"POST",
     headers:{"Content-Type":"application/json"},body:JSON.stringify(draft)});
    const result=await response.json() as {reference?:string;error?:string};
    if(!response.ok||!result.reference)throw new Error(result.error??"Unable to save local test booking");
    setSavedReference(result.reference);
    setSavedStatus("requested");
    return;
   }
   const payload=buildBookingSubmission({
    eventId:event.id!,clientRequestId:idempotency,
    tickets:tickets.map(t=>({id:t.id,quantity:quantities[t.id]??0})),
    guestInfo,childParents,adultCount:adultTicketCount,childCount:childTicketCount,
    adultSeatChildren,childcareHours,
    wholeTable:tableBooking,selectedKeys:mapSelections,seatAssignments,
   });
   const {data,error}=await supabase.rpc("submit_test12_booking",{...payload,p_promo_code:promoCode.trim()});
   if(error)throw error;
   const result=data as {reference?:unknown;status?:unknown;confirmation_email_status?:unknown}|null;
   if(typeof result?.reference!=="string"||!result.reference.startsWith("YMR-"))throw new Error("Invalid response");
   setSavedReference(result.reference);
   setSavedStatus(result.status==="confirmed"?"confirmed":"requested");
   setSavedEmailStatus(typeof result.confirmation_email_status==="string"?result.confirmation_email_status:null);
   if(marketingOptIn)await saveOptionalMarketingConsent(idempotency);
  }catch(error){
   const detail=error instanceof Error?error.message:"Unknown error";
   setBookingError(localTestMode?(en?`Could not save this test booking: ${detail}`:`Не удалось сохранить тестовую заявку: ${detail}`):
    (en?"The request could not be saved. Please try again or contact Marina.":"Не удалось сохранить заявку. Повторите попытку или свяжитесь с Мариной."));
  }finally{setSavingBooking(false)}
 }
 if(accessChoice==="choose")return <main className="flex min-h-[75vh] items-center justify-center bg-[#fff2db] px-4 py-12 text-black">
  <section className="w-full max-w-lg space-y-5 rounded-2xl border-2 border-black bg-white p-6 shadow-[5px_5px_0_#171717] sm:p-9">
   <Link href={`/events/${event.slug}`} className="text-sm font-semibold underline">{en?"← Event details":"← О мероприятии"}</Link>
   <h1 className="text-2xl font-black">{en?"How would you like to continue?":"Как хотите продолжить?"}</h1>
   <p className="text-sm text-gray-700">{en?"Sign in with Google to keep your details, or continue as a guest. An account is not required to book tickets.":"Войдите через Google, чтобы сохранить свои данные, или продолжите как гость. Для заказа билетов аккаунт не нужен."}</p>
   {accessError&&<p role="alert" className="rounded-lg bg-red-100 p-3 text-sm text-red-900">{accessError}</p>}
   <button type="button" disabled={accessBusy} onClick={()=>void chooseGoogle()} className="w-full rounded-lg border-2 border-black bg-white px-4 py-4 font-bold disabled:opacity-50">{en?"Continue with Google":"Продолжить через Google"}</button>
   <button type="button" onClick={()=>setAccessChoice("guest")} className="w-full rounded-lg bg-black px-4 py-4 font-bold text-white">{en?"Continue as guest":"Продолжить как гость"}</button>
   <p className="text-xs text-gray-600">{en?"Guest checkout still requires booking contact details. Seats are not reserved until confirmation.":"При оформлении без регистрации всё равно нужны контактные данные. Места закрепляются только после подтверждения."}</p>
  </section>
 </main>;
 return <main className="min-h-screen bg-[#fffaf1] pb-36 text-black">
   <div className="relative bg-[#fffaf1]">
     {(event.booking_image_url||event.image_url)?<img src={event.booking_image_url||event.image_url||""} alt="" className="h-32 w-full sm:h-44 lg:h-48" style={{objectFit:event.booking_image_fit==="contain"?"contain":"cover",objectPosition:`${event.booking_image_position_x??50}% ${event.booking_image_position_y??50}%`}}/>:<div className="h-40 w-full bg-[#f5a047]/30"/>}
   </div>
   <div className="mx-auto w-full max-w-[1600px] px-3 py-5 sm:px-6 sm:py-7 lg:px-10">
     <Link href={`/events/${event.slug}`} className="text-sm font-bold underline">{en?"← Back to event":"← Вернуться к мероприятию"}</Link>
     <h1 className="mt-3 text-2xl font-bold sm:text-3xl lg:text-4xl">{en&&event.title_en?event.title_en:event.title}</h1>
      {localTestMode&&<div role="note" className="mt-4 rounded-xl border-2 border-amber-500 bg-amber-50 p-4 text-sm">
       <strong>{en?"LOCAL TEST MODE — fictional details only":"ЛОКАЛЬНЫЙ ТЕСТ — только вымышленные данные"}</strong>
       <p className="mt-1">{en?"Requests are saved only on this computer; they are not real reservations or tickets and are not sent to Supabase. Do not enter real personal information.":"Заявки сохраняются только на этом компьютере, не являются бронями или билетами и не отправляются в Supabase. Не вводите настоящие личные данные."}</p>
      </div>}
     <div className="mt-5 flex flex-wrap items-center gap-2 text-xs font-semibold sm:text-sm">{([{id:"tickets",en:"Attendees",ru:"Гости"},{id:"guests",en:"Guest info",ru:"Данные"},{id:"seats",en:tableBooking?"Tables":"Adult seats",ru:tableBooking?"Столы":"Места взрослых"},{id:"review",en:"Review",ru:"Проверка"}] as const).filter(s=>s.id!=="seats"||needsSeats).map((s,i,steps)=><button type="button" key={s.id} disabled={i>steps.findIndex(item=>item.id===step)} onClick={()=>{if(!savedReference){setStep(s.id);window.scrollTo({top:0,behavior:"smooth"});}}} aria-current={step===s.id?"step":undefined} className={`rounded-full border px-3 py-2 ${step===s.id?"border-black bg-black text-white":i<steps.findIndex(item=>item.id===step)?"border-black/25 bg-white text-black underline underline-offset-2":"border-black/15 bg-white text-gray-400"} disabled:cursor-default`}>{i+1} · {en?s.en:s.ru}</button>)}</div>
     {step==="guests"?<section className="mx-auto mt-7 w-full max-w-3xl space-y-5 rounded-2xl border border-black/15 bg-white p-5 sm:p-8">
       <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-bold">{en?"Guest details":"Данные гостей"}</h2><button type="button" className="text-sm underline" onClick={()=>{setStep("tickets")}}>{en?"← Back to attendees":"← К гостям"}</button></div>
       <p className="text-sm text-gray-600">{en?"Enter a name, email and phone for each adult. For a child, enter their name and select the accompanying adult who should receive their ticket. Nothing is saved until you submit your booking request on the final review screen.":"Укажите имя, email и телефон каждого взрослого. Для ребёнка укажите имя и выберите сопровождающего взрослого, которому придёт билет ребёнка. Данные сохранятся только после отправки заявки на последнем шаге."}</p>
       {Array.from({length:adultTicketCount+childTicketCount},(_,i)=>{
         const key=String(i),guest=guestInfo[key]??{name:"",email:"",phone:""};
         const isChild=i>=adultTicketCount;
         const adultSeat=!tableBooking&&i<adultTicketCount?selections.find(s=>seatAssignments[s.key]===key):null;
         const assigned=adultSeat;
         const seatLabel=isChild?(en?"Spare seating at venue":"Дополнительные места на мероприятии"):tableBooking?(en?"Whole-table booking · individual seat assignment is not required":"Бронирование целого стола · назначение отдельных мест не требуется"):assigned?`${assigned.label} · ${en?"seat":"место"} ${assigned.seat}`:(en?"No seat selected":"Место не выбрано");
         const update=(field:"name"|"email"|"phone",value:string)=>setGuestInfo(old=>({...old,[key]:{...(old[key]??{name:"",email:"",phone:""}),[field]:value}}));
         const fieldClass="mt-1 block w-full rounded-lg border border-black/30 p-3";
         return <fieldset key={key} className="space-y-3 rounded-xl border border-black/15 p-4">
           <legend className="px-2 font-semibold">{isChild?(en?"Child":"Ребёнок"):(en?"Adult":"Взрослый")} {isChild?i-adultTicketCount+1:i+1}</legend>
           <p className="text-sm font-semibold text-gray-700">{seatLabel}</p>
           <label className="block text-sm font-semibold">{en?"Full name":"Имя и фамилия"} *<input autoComplete="off" required type="text" value={guest.name} onChange={e=>update("name",e.target.value)} aria-invalid={guestErrors&&!guest.name.trim()} data-guest-index={i} data-guest-field="name" className={fieldClass}/></label>
           {isChild?<div className="space-y-2">
             <label className="block text-sm font-semibold">{en?"Select parent / accompanying adult":"Выберите родителя / сопровождающего взрослого"} *
               <select required value={childParents[key]??""} onChange={e=>setChildParents(old=>({...old,[key]:e.target.value}))} className={fieldClass} aria-invalid={guestErrors&&guestProblems.some(p=>p.guestIndex===i&&p.field==="parent")} data-guest-index={i} data-guest-field="parent">
                 <option value="">{en?"Choose adult":"Выберите взрослого"}</option>
                 {Array.from({length:adultTicketCount},(_,adultIndex)=><option key={adultIndex} value={String(adultIndex)}>{guestInfo[String(adultIndex)]?.name.trim()||`${en?"Adult":"Взрослый"} ${adultIndex+1}`}</option>)}
               </select>
             </label>
             <p className="text-xs text-gray-600">{en?"The child's ticket and emergency contact will use this adult's email and phone.":"Билет ребёнка и экстренный контакт будут привязаны к email и телефону выбранного взрослого."}</p>
             {adultTicketCount===0&&<p className="text-xs font-semibold text-red-700">{en?"Add an accompanying adult ticket to assign a parent.":"Добавьте билет сопровождающего взрослого, чтобы выбрать родителя."}</p>}
           </div>:<div className="grid gap-3 sm:grid-cols-2">
             <label className="block text-sm font-semibold">{en?"Email address":"Электронная почта"} *<input type="email" required value={guest.email} onChange={e=>update("email",e.target.value)} aria-invalid={guestErrors&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guest.email.trim())} data-guest-index={i} data-guest-field="email" className={fieldClass}/></label>
             <label className="block text-sm font-semibold">{en?"Phone number":"Номер телефона"} *<input type="tel" required value={guest.phone} onChange={e=>update("phone",e.target.value)} aria-invalid={guestErrors&&!guest.phone.trim()} data-guest-index={i} data-guest-field="phone" className={fieldClass}/></label>
           </div>}
         </fieldset>;
       })}
       {!needsSeats&&pricingIncomplete&&<p role="status" className="text-sm font-semibold text-red-700">{en?"A ticket price is invalid. The organiser must correct it before review.":"Цена билета некорректна. Организатор должен исправить её перед проверкой."}</p>}
        {guestErrors&&guestProblems.length>0&&<div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm font-semibold text-red-800"><p>{en?"Please complete these specific details:":"Пожалуйста, заполните следующие поля:"}</p><ul className="mt-2 list-inside list-disc">{guestProblems.map(p=><li key={`${p.guestIndex}:${p.field}`}>{guestErrorLabel(p)}</li>)}</ul></div>}
       <button type="button" onClick={continueFromGuestInfo} className="w-full rounded-lg bg-black px-4 py-3 font-semibold text-white">{needsSeats?(tableBooking?(en?"Choose tables →":"Выбрать столы →"):(en?"Choose adult seats →":"Выбрать места взрослых →")):(en?"Review →":"Проверить →")}</button>
       <p className="rounded-lg bg-[#fff2db] p-4 text-sm">{en?"Your booking is not saved yet. Complete the next steps to reach the final review.":"Заявка ещё не сохранена. Продолжите оформление до последней страницы проверки."}</p>
       <button type="button" onClick={()=>{setStep("tickets")}} className="w-full rounded-lg border border-black/30 px-5 py-3 font-semibold">{en?"Back to attendees":"Назад к гостям"}</button>
     </section>:step==="review"?<section className="mx-auto mt-7 w-full max-w-3xl space-y-5 rounded-2xl border border-black/15 bg-white p-5 sm:p-8" aria-label={en?"Order review":"Проверка заказа"}>
       <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-bold">{en?"Review your selection":"Проверьте ваш выбор"}</h2><button type="button" onClick={()=>{if(!savedReference)setStep(needsSeats?"seats":"guests")}} className="text-sm font-semibold underline">{en?"← Edit":"← Изменить"}</button></div>
       <p className="text-sm text-gray-600">{en?"Check each guest, assigned seat and total before proceeding. This is a preview only.":"Проверьте гостей, их места и итоговую сумму. Сейчас это только предварительный просмотр."}</p>
       <div><h3 className="mb-2 font-semibold">{en?"Admission tickets":"Входные билеты"}</h3>{tickets.filter(t=>(quantities[t.id]??0)>0).map(t=><div key={t.id} className="flex justify-between gap-3 border-b border-black/10 py-2 text-sm"><span>{t.name} × {quantities[t.id]}</span><span>{seatedPricing&&classifyTicket(t.name)==="adult"?(en?"Included in seat prices":"Включено в стоимость мест"):format.format(t.price_cents*(quantities[t.id]??0)/100)}</span></div>)}</div>
       {event.seating_mode!=="general_admission"&&<div><h3 className="mb-2 font-semibold">{tableBooking?(en?"Selected tables":"Выбранные столы"):(en?"Selected seats":"Выбранные места")}</h3>{selections.length===0?<p className="text-sm text-gray-600">{en?"No seats selected":"Места не выбраны"}</p>:selections.map(s=><div key={s.key} className="flex justify-between gap-3 border-b border-black/10 py-2 text-sm"><span>{s.label}{s.seat?` · ${en?"seat":"место"} ${s.seat}`:""}</span><span>{s.cost==null?(en?"Price not set":"Цена не указана"):format.format(s.cost/100)}</span></div>)}</div>}
       <div className="space-y-1 border-t border-black/20 pt-4"><div className="flex justify-between text-sm"><span>{en?"Tickets":"Билеты"}</span><span>{format.format(ticketTotal/100)}</span></div><div className="flex justify-between text-sm"><span>{tableBooking?(en?"Tables":"Столы"):(en?"Seats":"Места")}</span><span>{pricingIncomplete?(en?"Price pending":"Цена уточняется"):format.format((tableBooking?tableTotal:seatTotal)/100)}</span></div><div className="flex justify-between pt-2 text-lg font-bold"><span>{en?"Total":"Итого"}</span><span>{pricingIncomplete?(en?"Price pending":"Цена уточняется"):!localTestMode&&promoCode.trim()==="TEST12"?<span className="flex flex-col items-end"><s className="text-sm font-normal text-gray-500">{format.format((total??0)/100)}</s><strong>{format.format(0)}</strong><small className="text-xs font-normal text-gray-600">{en?"Subject to database approval":"После проверки кода в базе"}</small></span>:format.format((total??0)/100)}</span></div></div>
       {pricingIncomplete&&<p role="status" className="rounded-lg border border-orange-300 bg-orange-50 p-4 text-sm">{en?`Unpriced table(s): ${tablesWithoutPrices.join(", ")||"ticket type"}. Marina needs to set these prices.`:`Нет цены для стола: ${tablesWithoutPrices.join(", ")||"тип билета"}. Марина должна указать эту цену.`}</p>}
       {childTicketCount>0&&<p className="rounded-lg border border-amber-200 bg-[#fffaf0] p-3 text-sm"><strong>{en?"Children’s seating: ":"Места для детей: "}</strong>{en?"There will be spare seats at the venue for children. You do not need to select or pay for a reserved table seat for them.":"На мероприятии будут дополнительные места для детей. Выбирать и оплачивать отдельное место за столом для ребёнка не нужно."}</p>}
       <p className="rounded-lg bg-[#fff2db] p-4 text-sm">{en?"This is a preview only. Seats have not been reserved. Payment and order confirmation are not available yet.":"Это предварительный расчёт. Места не забронированы. Оплата и подтверждение заказа пока недоступны."}</p>
       <div className="rounded-lg border border-black/15 p-4"><h3 className="font-semibold">{en?"Guests and assigned seats":"Гости и их места"}</h3>{Array.from({length:adultTicketCount+childTicketCount},(_,i)=>{const key=String(i);const seat=selections.find(s=>seatAssignments[s.key]===key);return <p key={key} className="mt-2 text-sm">{guestInfo[key]?.name||`${i<adultTicketCount?(en?"Adult":"Взрослый"):(en?"Child":"Ребёнок")} ${i+1}`} — {i>=adultTicketCount?(en?"Spare seating at venue":"Дополнительные места на мероприятии"):tableBooking?(en?"Included in whole-table selection · no individual seat assigned":"Включён в бронирование стола · отдельное место не назначено"):seat?`${seat.label} · ${seat.seat}`:(en?"No reserved seat":"Без закреплённого места")}{i>=adultTicketCount&&childParents[key]!==undefined?<span className="block pl-3 text-xs text-gray-600">{en?"Accompanying adult":"Сопровождающий взрослый"}: {guestInfo[childParents[key]]?.name||`${en?"Adult":"Взрослый"} ${Number(childParents[key])+1}`} · {guestInfo[childParents[key]]?.email}</span>:null}</p>})}</div>
       {savedReference?<section role="status" className="rounded-xl border-2 border-green-700 bg-green-50 p-5">
         <h3 className="text-lg font-bold">{savedStatus==="confirmed"?(en?"Free reservation confirmed":"Бесплатная бронь подтверждена"):(en?"Booking request received":"Заявка на бронирование получена")}</h3>
         <p className="mt-2">{en?"Your reference":"Номер заявки"}: <strong className="font-mono text-xl">{savedReference}</strong></p>
         <p className="mt-2 text-sm">{localTestMode?(en?"Saved locally for testing only. No seat is reserved.":"Сохранено только для локального теста. Место не закреплено."):savedStatus==="confirmed"?(en?"TEST12 covered the full price: NZ$0 payable. Your selected seats are reserved.":"Промокод TEST12 полностью покрыл стоимость: к оплате NZ$0. Выбранные места забронированы."):(en?"Request received, but seats are not yet reserved.":"Заявка получена, но места пока не забронированы.")}</p>
         {!localTestMode&&savedEmailStatus==="pending"&&<p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm">{en?"Confirmation email pending. It has not been sent yet; please keep your reference.":"Отправка письма с подтверждением ожидается. Письмо ещё не отправлено; сохраните номер брони."}</p>}
         {localTestMode&&<Link href="/admin/bookings" className="mt-3 inline-block rounded-lg border border-green-800 bg-white px-4 py-3 font-semibold underline">{en?"View saved test bookings →":"Смотреть тестовые заявки →"}</Link>}
          {marketingResult==="subscribed"&&<p className="mt-3 rounded bg-white p-3 text-sm font-semibold text-green-900">{en?"Future-event invitations: the chosen adult is on Marina's opt-in email list. Every email will include an unsubscribe option.":"Приглашения на будущие мероприятия: выбранный взрослый добавлен в список по согласию. В каждом письме будет ссылка отписки."}</p>}
          {marketingResult==="not_subscribed"&&<p className="mt-3 rounded bg-white p-3 text-sm text-orange-900">{en?"This email was previously unsubscribed and has not been re-added. Contact Marina if you wish to sign up again.":"Этот адрес ранее отписался и не был добавлен повторно. Чтобы подписаться снова, свяжитесь с Мариной."}</p>}
          {marketingResult==="failed"&&<div className="mt-3 rounded bg-white p-3 text-sm"><p>{en?"Your booking request was saved, but the optional future-event signup could not be completed.":"Заявка сохранена, но подписка на будущие мероприятия не удалась."}</p><button type="button" disabled={marketingBusy} onClick={()=>{if(requestId.current)void saveOptionalMarketingConsent(requestId.current)}} className="mt-2 rounded border border-black px-3 py-2 font-semibold disabled:opacity-50">{en?"Retry optional signup":"Повторить подписку"}</button></div>}

       </section>:(localTestMode||(event.id&&requestsEnabled))?<section className="space-y-3 rounded-xl border border-black/20 bg-[#fffaf1] p-5">
         <h3 className="font-bold">{localTestMode?(en?"Save fictional test booking":"Сохранить тестовую заявку"):(en?"Send booking request":"Отправить заявку на бронирование")}</h3>
         <p className="text-sm">{localTestMode?(en?"Use fictional details only. This is a local demonstration.":"Используйте только вымышленные данные. Это локальная демонстрация."):(en?"Use TEST12 to reserve selected seats without payment. You will see a booking reference immediately; email delivery may still be pending.":"С TEST12 можно забронировать выбранные места без оплаты. Номер брони появится сразу; отправка письма может ожидать настройки.")}</p>
         {pricingIncomplete&&<p className="text-sm font-semibold text-orange-800">{en?"One or more prices are pending. Your request can still be saved, but is not confirmed.":"Одна или несколько цен ещё не указаны. Заявку можно сохранить, но она не подтверждена."}</p>}
         <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={bookingConsent} onChange={e=>setBookingConsent(e.target.checked)} className="mt-1 h-5 w-5" /><span>{localTestMode?(en?"I understand this is fictional test data saved only on this computer, not a real booking.":"Я понимаю, что это вымышленные тестовые данные, сохранённые только на этом компьютере, а не настоящая бронь."):(en?"I understand Marina's event organisers will use these names and adult contact details to manage this request. No payment will be taken.":"Я понимаю, что организаторы Марины будут использовать имена гостей и контактные данные взрослых для обработки заявки. Оплата не производится.")}</span></label>
         {!localTestMode&&<>
          <div className="space-y-2 rounded-lg border border-black/15 bg-white p-4">
           <label className="flex items-start gap-3 text-sm">
             <input type="checkbox" aria-label={en?"Email me about future Yumorilnik events (optional)":"Присылать приглашения на будущие мероприятия (необязательно)"} checked={marketingOptIn} onChange={e=>setMarketingOptIn(e.target.checked)} className="mt-1 h-5 w-5" />
             <span><strong>{en?"Optional — future event invitations":"Необязательно — приглашения на будущие мероприятия"}</strong>
               <span className="mt-1 block text-gray-700">{en?"The selected adult agrees to receive occasional Yumorilnik/Marina event invitations by email, and I am this person or have their permission. This is separate from this booking; they can unsubscribe at any time.":"Выбранный взрослый согласен получать приглашения на мероприятия Юморильника / Марины по электронной почте. Я и есть этот человек или у меня есть его разрешение. Это отдельно от бронирования; отписаться можно в любой момент."}</span>
             </span>
           </label>
           {marketingOptIn&&adultTicketCount>0&&<label className="block text-sm font-semibold">{en?"Email invitations to":"Кому присылать приглашения"}
             <select value={marketingAdultIndex} onChange={e=>setMarketingAdultIndex(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-black/30 bg-white p-3">
              {Array.from({length:adultTicketCount},(_,i)=><option key={i} value={i}>{guestInfo[String(i)]?.name||`${en?"Adult":"Взрослый"} ${i+1}`} · {guestInfo[String(i)]?.email}</option>)}
             </select>
             <span className="mt-1 block text-xs font-normal text-gray-600">{en?"Only this adult's email will be added, and only if this separate checkbox is ticked.":"Добавится только электронная почта этого взрослого и только при отдельном согласии."}</span>
           </label>}
         </div>
                  </>}
         {!localTestMode&&<div className="rounded-lg border border-black/15 p-4"><h3 className="font-semibold">{en?"Promo code":"Промокод"}</h3><p className="mt-1 text-sm text-gray-600">{en?"TEST12 will make an eligible booking free when the organiser enables this promotion. A code is checked in the database; typing it does not reserve seats.":"TEST12 сделает заказ бесплатным, когда организатор включит акцию. Код проверяется в базе данных; ввод кода сам по себе не бронирует места."}</p><input value={promoCode} onChange={e=>setPromoCode(e.target.value.toUpperCase().trimStart())} disabled={!!savedReference||localTestMode} maxLength={32} autoComplete="off" placeholder={en?"Enter code":"Введите код"} aria-label={en?"Promo code":"Промокод"} className="mt-2 w-full rounded-lg border border-black/20 bg-white p-3 disabled:bg-gray-100" />{!localTestMode&&promoCode.trim()==="TEST12"&&<p className="mt-2 text-sm font-semibold text-green-800">{en?"Code entered. Final discount will be verified when you submit.":"Код введён. Скидка будет проверена при отправке заказа."}</p>}</div>}
         {bookingError&&<p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-800">{bookingError}</p>}
         <button type="button" disabled={!bookingConsent||!canReview||savingBooking||(!localTestMode&&promoCode.trim()!=="TEST12")} onClick={()=>void submitBookingRequest()} className="min-h-12 w-full rounded-lg bg-black px-5 py-4 font-bold text-white disabled:opacity-40">{savingBooking?(en?"Saving request…":"Сохраняем заявку…"):localTestMode?(en?"Save test booking":"Сохранить тестовую заявку"):(en?"Reserve seats for NZ$0 with TEST12":"Забронировать места за NZ$0 с TEST12")}</button>
       </section>:<p className="rounded-lg bg-gray-100 p-4 text-sm">{en?"Booking request saving is not enabled yet; please contact Marina.":"Сохранение заявок пока не подключено. Свяжитесь с Мариной."}</p>}

       {!savedReference&&<button type="button" onClick={()=>setStep("guests")} className="w-full rounded-lg border border-black/30 px-5 py-3 font-semibold">{en?"Edit guest details":"Изменить данные гостей"}</button>}
     </section>:<div className="mt-6 flex flex-col gap-8">
       {step==="tickets"&&<section aria-labelledby="tickets-title" className="space-y-3">
         {nyeChildcare&&<p role="note" className="rounded-lg border border-orange-300 bg-orange-50 px-4 py-3 text-sm font-semibold">{en?"Want your child to have an assigned seat at the table? Book them as an adult.":"Хотите, чтобы у ребёнка было закреплённое место за столом? Оформите для него взрослый билет."}</p>}
         <h2 id="tickets-title" className="text-xl font-bold">{en?"How many tickets?":"Сколько билетов?"}</h2>
         <p className="text-sm text-gray-600">{en?"Choose the number of adults and children attending. You will choose seats on the next screen.":"Выберите количество взрослых и детей. Места можно будет выбрать на следующем экране."}</p>
         {count>0&&!canContinueTickets&&<p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">{ticketPricesInvalid?(en?"A ticket price is invalid. The organiser needs to correct it before booking can continue.":"Цена билета некорректна. Организатор должен исправить её перед продолжением."):(en?"Please include an adult for every child booking, and use Adult/Child ticket types for this journey.":"Для заказа с детьми добавьте хотя бы одного взрослого. Используйте типы билетов «Взрослый» и «Детский».")}</p>}
         {tickets.length===0?<p className="rounded-xl border border-black/15 bg-white p-5">{en?"No tickets have been added yet.":"Билеты пока не добавлены."}</p>:<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{tickets.map(ticket=>{
            const quantity=quantities[ticket.id]??0;
            const remaining=ticket.quantity_total==null?max:Math.max(0,ticket.quantity_total-(ticket.quantity_sold??0));
            return <div key={ticket.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-black/15 bg-white px-4 py-3">
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold">{ticket.name}</h3>
                {ticket.description&&<p className="mt-1 text-sm text-gray-600">{ticket.description}</p>}
                <p className="mt-1 font-semibold">{seatedPricing&&/adult|взросл/i.test(ticket.name)?(en?"Choose a table seat to see the adult price":"Выберите место за столом, чтобы увидеть цену взрослого билета"):format.format(ticket.price_cents/100)}</p>
                {seatedPricing&&/child|детск|ребён|ребен/i.test(ticket.name)&&<div className="mt-2 rounded-lg bg-[#f7f5f1] p-3 text-sm leading-5 text-gray-700">
                  <strong className="block">{nyeChildcare?(en?"Childcare ticket — 3 or 6 hours":"Детский билет — 3 или 6 часов"):(en?"Child admission":"Детский вход")}</strong>
                  <p className="mt-1">{nyeChildcare?(en?"In Guest details, choose 3 hours (NZ$30) or 6 hours (NZ$60) for each child. Spare seating is provided. For an assigned table seat, book an adult-priced ticket.":"В данных гостей выберите 3 часа (NZ$30) или 6 часов (NZ$60) для каждого ребёнка. Дополнительные места предоставляются. Для закреплённого места за столом оформите взрослый билет."): (en?"There will be spare seats at the venue for children. No table seat selection or extra seat charge is needed.":"На мероприятии будут дополнительные места для детей. Выбирать место за столом и доплачивать за него не нужно.")}</p>
                </div>}
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
         <button type="button" onClick={()=>setStep("guests")} className="text-sm font-semibold underline">{en?"← Edit guest details":"← Изменить данные гостей"}</button>
         {seatFeedback&&<p role="status" className="rounded-lg border border-amber-400 bg-amber-50 p-3 text-sm font-semibold">{seatFeedback}</p>}
          {tableBooking&&<div className="rounded-xl border border-[#f5a047] bg-white p-4"><h3 className="font-bold">{en?"Whole tables":"Целые столы"}</h3><p className="mt-1 text-sm">{en?"Choose enough table places for every adult. Children do not receive separately assigned seats in this mode.":"Выберите столы с достаточным количеством мест для всех взрослых. В этом режиме отдельные места для детей не назначаются."}</p><p className="mt-2 font-semibold">{en?"Available places for adults":"Мест для взрослых"}: {tableCapacity}/{adultTicketCount}</p>{!tableHasAdultCapacity&&<p role="status" className="mt-2 text-sm text-amber-800">{en?"Select additional tables before continuing.":"Выберите дополнительные столы для продолжения."}</p>}</div>}
          {step==="seats"&&!tableBooking&&<div className="rounded-xl border border-[#f5a047] bg-white p-4"><h3 className="font-bold">{en?"Assign a seat to each adult":"Выберите место для каждого взрослого"}</h3><p className="mt-1 text-sm text-gray-600">{en?"Select a name, then tap their numbered seat on the map.":"Выберите имя, затем нажмите на номер места на схеме."}</p><div className="mt-3 flex flex-wrap gap-2">{Array.from({length:adultTicketCount},(_,i)=>{const key=String(i);const assigned=selections.find(s=>seatAssignments[s.key]===key);return <button type="button" key={key} onClick={()=>{setActiveSeatGuest(key);setSeatFeedback("");}} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${activeSeatGuest===key?"border-black bg-black text-white":"border-black/20 bg-[#fffaf1]"}`}>{guestInfo[key]?.name||`${en?"Adult":"Взрослый"} ${i+1}`}{assigned?` · ${assigned.label}/${assigned.seat} ✓`:" · +"}</button>})}</div><p className="mt-3 text-sm font-bold">{adultSeats}/{adultTicketCount} {en?"adult seats assigned":"мест для взрослых выбрано"}</p></div>}
         {step==="seats"&&seatsStillNeeded>0&&<p role="status" className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold">{en?`Assign ${seatsStillNeeded} more adult ${seatsStillNeeded===1?"seat":"seats"} to continue.`:`Чтобы продолжить, выберите ещё ${seatsStillNeeded} ${seatsStillNeeded===1?"место":"места"} для взрослых.`}</p>}
         {step==="seats"&&seatsStillNeeded===0&&!tableBooking&&<p role="status" className="rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm font-semibold">{en?"All adult seats assigned. You can continue below.":"Все взрослые рассажены. Можно переходить дальше."}</p>}
         {pricingIncomplete&&mapSelections.length>0&&<p role="status" className="rounded-lg border border-orange-300 bg-orange-50 px-4 py-3 text-sm">{en?`Price not set for table(s): ${tablesWithoutPrices.join(", ")||"ticket type"}. You can continue to the review preview, but payment and confirmed reservations remain unavailable.`:`Не указана цена за место для стола: ${tablesWithoutPrices.join(", ")||"тип билета"}. Вы можете продолжить проверку, но оплата и подтверждение брони пока недоступны.`}</p>}
         <h2 id="seating-title" className="text-xl font-bold">{event.seating_mode==="general_admission"?(en?"General admission":"Вход без закреплённых мест"):event.seating_mode==="tables"?(event.table_booking_mode==="individual_seats"?(en?"Seats at tables":"Места за столами"):(en?"Whole-table booking":"Бронирование столов")):(en?"Seating":"Рассадка")}</h2>
         {event.seating_mode!=="general_admission"&&venue&&(venue.tables.length>0||venue.features.length>0)?<CustomerVenueMap tables={venue.tables} features={venue.features} stage={venue.stage} mode={seatingMode} selectedKeys={mapSelections} onToggle={toggleMapSelection} zones={venue.zones} />:<div className="flex min-h-80 flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-black/20 bg-white p-6 text-center sm:min-h-[450px]">
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
         <p className="text-xs text-gray-600">{en?"Adults":"Взрослые"}: {adultTicketCount} · {en?"Children":"Дети"}: {childTicketCount} · {tableBooking?(en?"Tables":"Столы"):(en?"Seats":"Места")}: {mapSelections.length}</p>
         <p className="text-xs text-gray-600">{en?"Admission":"Вход"}: {format.format(ticketTotal/100)} · {en?"Reserved seats":"Места"}: {pricingIncomplete?(en?"Price pending":"Цена уточняется"):format.format((tableBooking?tableTotal:seatTotal)/100)}</p>
         <p className="text-xl font-black sm:text-2xl">{pricingIncomplete?(en?"Price pending":"Цена уточняется"):format.format((total??0)/100)}</p>
       </div>
       {step==="tickets"?<button type="button" disabled={!canContinueTickets} onClick={()=>{setStep("guests");window.scrollTo({top:0,behavior:"smooth"})}} className="min-h-12 shrink-0 rounded-lg bg-black px-4 py-3 text-sm font-bold text-white disabled:opacity-45">{en?"Enter guest info →":"Данные гостей →"}</button>:
        step==="seats"?<button type="button" disabled={!canReview} onClick={()=>{setStep("review");window.scrollTo({top:0,behavior:"smooth"})}} className="min-h-12 shrink-0 rounded-lg bg-black px-4 py-3 text-sm font-bold text-white disabled:opacity-45">{en?"Review →":"Проверить →"}</button>:
         <span className="max-w-40 text-right text-xs text-gray-500">{en?"Preview only · Not a reservation":"Предпросмотр · Не бронь"}</span>}
     </div>
   </div>
 </main>;
}
