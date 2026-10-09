"use client";
import Link from "next/link";
import type { ReactNode } from "react";

export type EventPageData = {
  slug:string; title:string; description:string|null; event_date:string;
  event_time:string; location:string|null; image_url:string|null; detail_image_url?:string|null; banner_fit?:string; banner_position_x?:number; banner_position_y?:number; detail_fit?:string; detail_position_x?:number; detail_position_y?:number;
};
type Props = { event:EventPageData; editable?:boolean; heading?:ReactNode; description?:ReactNode;
  dateAndPlace?:ReactNode; bannerControl?:ReactNode; imageControl?:ReactNode;
  bookingHref?:string; bookingAction?:()=>void; bookingDisabled?:boolean };
export default function EventPresentation({event,editable=false,heading,description,dateAndPlace,bannerControl,imageControl,bookingHref,bookingAction,bookingDisabled=false}:Props){
 const banner=event.image_url;
 const detail=event.detail_image_url;
 return <article className="w-full bg-[#fffaf1] text-black">
   <div className="relative bg-[#fffaf1]">
     {banner?<img src={banner} alt="" style={{objectFit:event.banner_fit==="contain"?"contain":"cover",objectPosition:`${event.banner_position_x??50}% ${event.banner_position_y??50}%`}} className="h-[68vh] min-h-[420px] w-full sm:h-[78vh] lg:h-[86vh]"/>:
     <div className="flex h-[68vh] min-h-[420px] items-center justify-center bg-[#f5a047]/40 text-sm sm:h-[78vh] lg:h-[86vh]">Event banner image</div>}
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
       <div className="relative rounded-lg bg-[#f5a047]/20">
         {detail?<img src={detail} alt="" style={{objectFit:event.detail_fit==="contain"?"contain":"cover",objectPosition:`${event.detail_position_x??50}% ${event.detail_position_y??50}%`}} className="h-[65vh] min-h-[420px] w-full bg-[#fffaf1] sm:h-[85vh]"/>:
          <div className="flex h-[65vh] min-h-[420px] items-center justify-center sm:h-[85vh] px-4 text-center text-sm text-gray-600">Event photograph</div>}
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
