"use client";
import Link from "next/link";
import type { ReactNode } from "react";

export type EventPageData = {
  slug:string; title:string; description:string|null; event_date:string;
  event_time:string; location:string|null; image_url:string|null;
};
type Props = { event:EventPageData; editable?:boolean; heading?:ReactNode; description?:ReactNode;
  dateAndPlace?:ReactNode; bannerControl?:ReactNode; imageControl?:ReactNode;
  bookingHref?:string; bookingAction?:()=>void; bookingDisabled?:boolean };
export default function EventPresentation({event,editable=false,heading,description,dateAndPlace,bannerControl,imageControl,bookingHref,bookingAction,bookingDisabled=false}:Props){
 const photo=event.image_url;
 return <article className="w-full overflow-hidden bg-[#fffaf1] text-black">
   <div className="relative bg-[#1b1714]">
     {photo?<img src={photo} alt="" className="h-[45vh] min-h-64 w-full object-cover sm:h-[58vh] lg:h-[68vh]"/>:
     <div className="flex h-[45vh] min-h-64 items-center justify-center bg-[#f5a047]/40 text-sm sm:h-[58vh] lg:h-[68vh]">Event banner image</div>}
     {bannerControl&&<div className="absolute bottom-4 right-4">{bannerControl}</div>}
   </div>
   <div className="px-5 pb-14 pt-7 sm:px-10 sm:pt-10 lg:px-[6vw]">
     <div className="mb-7 flex flex-col gap-4 border-b border-black/15 pb-6 md:flex-row md:items-start md:justify-between">
       <div className="min-w-0 flex-1">{heading??<h1 className="text-3xl font-black leading-tight sm:text-5xl">{event.title}</h1>}</div>
       <div className="shrink-0 md:max-w-64 md:text-right">{dateAndPlace??<div className="space-y-1 font-semibold"><p>{event.event_date} · {event.event_time.slice(0,5)}</p><p>{event.location||"Venue to be confirmed"}</p></div>}</div>
     </div>
     <div className="grid gap-7 md:grid-cols-[minmax(0,1fr)_minmax(0,0.82fr)] md:items-start md:gap-10">
       <section className="min-w-0">
         <h2 className="mb-3 text-xl font-black">О мероприятии</h2>
         {description??<p className="whitespace-pre-wrap leading-7">{event.description||"Описание скоро появится."}</p>}
       </section>
       <div className="relative overflow-hidden rounded-lg bg-[#f5a047]/20">
         {photo?<img src={photo} alt="" className="aspect-[4/5] w-full object-cover"/>:
          <div className="flex aspect-[4/5] items-center justify-center px-4 text-center text-sm text-gray-600">Event photograph</div>}
         {imageControl&&<div className="absolute bottom-3 right-3">{imageControl}</div>}
       </div>
     </div>
     <div className="mt-8 border-t border-black/15 pt-7">
       {bookingAction?<button type="button" disabled={bookingDisabled} onClick={bookingAction} className="inline-flex min-h-12 items-center justify-center rounded-lg bg-black px-8 py-3 font-bold text-white disabled:opacity-50">Билеты →</button>:
        <Link href={bookingHref??`/events/${event.slug}/book`} className="inline-flex min-h-12 items-center justify-center rounded-lg bg-black px-8 py-3 font-bold text-white">Билеты →</Link>}
       <p className="mt-3 text-sm text-gray-600">Заказ еды станет доступен после оформления билетов.</p>
     </div>
   </div>
 </article>;
}
