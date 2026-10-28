export type ConfirmationMessageInput={
 language:"ru"|"en";
 reference:string;
 eventName:string;
 eventDateText:string;
 adults:{name:string;email:string}[];
 children:{name:string;accompanyingAdultEmail:string;childcareHours?:number|null;adultPricedSeat?:boolean}[];
 places:{guestName:string;table:string;seat:number|null}[];
 promoCode:string|null;
 totalCents:number;
 currency:string;
};
/** Email content only. Sending is deliberately handled by a separate verified provider. */
export function bookingConfirmationEmail(input:ConfirmationMessageInput){
 const en=input.language==="en";
 const amount=new Intl.NumberFormat("en-NZ",{style:"currency",currency:input.currency}).format(input.totalCents/100);
 const attendees=[...input.adults.map(x=>x.name),...input.children.map(x=>x.name)];
 const intro=en?"Your Yumorilnik booking is confirmed.":"Ваше бронирование на Юморильнике подтверждено.";
 const details=[
  intro,
  "",
  `${en?"Booking reference":"Номер брони"}: ${input.reference}`,
  `${en?"Event":"Мероприятие"}: ${input.eventName}`,
  `${en?"Date / time":"Дата / время"}: ${input.eventDateText}`,
  `${en?"Guests":"Гости"}: ${attendees.join(", ")}`,
  ...input.places.map(place=>`${place.guestName}: ${place.table}${place.seat===null?"":` · ${en?"seat":"место"} ${place.seat}`}`),
  ...input.children.filter(c=>c.childcareHours).map(c=>`${c.name}: ${en?"Childcare":"Присмотр"} — ${c.childcareHours} ${en?"hours":"часов"}`),
  ...input.children.filter(c=>c.adultPricedSeat).map(c=>`${c.name}: ${en?"adult-priced table seat; babysitting arranged at the event":"место по взрослому тарифу; присмотр согласовывается на мероприятии"}`),
  `${en?"Promo code":"Промокод"}: ${input.promoCode??"—"}`,
  `${en?"Paid":"Оплачено"}: ${amount}`,
  "",
  en?"Children will have spare seating at the venue.":"Для детей будут дополнительные места на мероприятии.",
  en?"Please keep this booking reference and check the event details before travelling.":"Сохраните номер брони и проверьте данные мероприятия перед поездкой.",
 ];
 return {
  subject:en?`Yumorilnik booking confirmed · ${input.reference}`:`Бронирование Юморильник подтверждено · ${input.reference}`,
  text:details.join("\n"),
 };
}
