import {bookingConfirmationHtml, type ConfirmationGuest} from "@/lib/bookingConfirmationTemplate";
export type CorrectionGuest={guest_index:number;full_name:string;email:string|null;category:string;is_child_with_adult_seat:boolean;childcare_hours:number|null;guardian_index:number|null;accompanying_adult_index:number|null};
export type CorrectionSeat={guest_index:number|null;table_label:string;seat_number:number|null};
export type CorrectionEvent={title:string;title_en:string|null;event_date:string;event_time:string|null;location:string|null;slug:string|null};
const money=(cents:number,currency:string)=>new Intl.NumberFormat("en-NZ",{style:"currency",currency:currency||"NZD"}).format(cents/100);
export function correctedConfirmation(input:{
 reference:string;event:CorrectionEvent;guests:CorrectionGuest[];seats:CorrectionSeat[];
 organiser:boolean;amountCents:number;currency:string;promoCode:string|null;
}){
 const {event,reference,guests,seats,organiser}=input;
 const date=new Date(event.event_date+"T"+(event.event_time??"19:30"));
 const formatted=Number.isNaN(date.getTime())?event.event_date+" "+(event.event_time??""):
  date.toLocaleString("en-NZ",{dateStyle:"full",timeStyle:"short",timeZone:"Pacific/Auckland"});
 const rows:ConfirmationGuest[]=guests.map(g=>{
  const seat=seats.find(x=>x.guest_index===g.guest_index);
  return {name:g.full_name,ticket:g.is_child_with_adult_seat?"Adult-priced seat / Место по взрослому тарифу":
   g.category==="child"?"Childcare / Присмотр":"Adult / Взрослый",
   table:seat?.table_label??null,seat:seat?.seat_number??null,childcareHours:g.childcare_hours};
 });
 const message=organiser?
  "Updated booking summary / Обновлённая сводка бронирования":
  "Updated booking confirmation / Обновлённое подтверждение бронирования";
 const intro=organiser?
  "One consolidated copy of the booking, with every ticket and admission QR code attached. / Одна общая сводка со всеми билетами и QR-кодами во вложении.":
  "This updated confirmation includes everyone in your booking. Your valid tickets are attached for the people using this email address. Your booking and seats remain unchanged. No additional payment is needed. / В этом письме перечислены все гости вашей брони. Ваши билеты приложены к письму. Бронь и места не изменились. Доплачивать ничего не нужно.";
 const details=organiser?[
  "Contact details / Контакты:",
  ...guests.map(g=>g.full_name+" — "+(g.email??"—")),
  "Amount paid / Оплачено: "+money(input.amountCents,input.currency),
  "Promo code / Промокод: "+(input.promoCode??"—")
 ].join("\n"):null;
 const html=bookingConfirmationHtml({
  eventTitle:event.title, eventDate:formatted,reference,guests:rows,
  venue:event.location,eventUrl:event.slug?"https://yumorilnik.com/events/"+encodeURIComponent(event.slug):null,
  matryoshkaUrl:"https://matryoshka.nz/events/novogodnik26?ticket_ref="+encodeURIComponent(reference),
  isTest:false,organiser,
  arrivalInstructions:intro,
  organiserDetails:details
 });
 // The template already lists all names, ticket types and seats. Explicitly label this as an update.
 const decorated=html.replace("Ваше бронирование / Booking confirmation",message)
  .replace("Сводка для организатора / Organiser booking summary",message);
 const plain=[message, event.title,formatted, "Booking / Бронь: "+reference, intro,
  "Full party / Все гости:",
  ...rows.map(g=>g.name+" — "+g.ticket+" — "+(g.table??"—")+(g.seat==null?"":" · "+g.seat)),
  ...(details?[details]:[])].join("\n");
 return {subject:(organiser?"[Organiser / Организатор] ":"")+"Updated tickets / Обновлённые билеты · "+reference,
  html:decorated,text:plain};
}
