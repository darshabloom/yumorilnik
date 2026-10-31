"use client";
import Link from "next/link";
import EventMarkdown from "@/components/EventMarkdown";
import type { ReactNode } from "react";
import {useSiteLanguage} from "@/lib/useSiteLanguage";

export type EventPageData = {
  slug:string; title:string; title_en?:string|null; description:string|null; description_en?:string|null; event_date:string;
  event_time:string; location:string|null; image_url:string|null; detail_image_url?:string|null; banner_fit?:string; banner_position_x?:number; banner_position_y?:number; detail_fit?:string; detail_position_x?:number; detail_position_y?:number;
};
type Props = { event:EventPageData; editable?:boolean; heading?:ReactNode; description?:ReactNode;
  dateAndPlace?:ReactNode; bannerControl?:ReactNode; imageControl?:ReactNode;
  bookingHref?:string; bookingAction?:()=>void; bookingDisabled?:boolean };
export default function EventPresentation({event,editable=false,heading,description,dateAndPlace,bannerControl,imageControl,bookingHref,bookingAction,bookingDisabled=false}:Props){
 const en=useSiteLanguage()==="en";
 const banner=event.image_url;
 const detail=event.detail_image_url;
 return <article className="w-full bg-[#fffaf1] text-black">
   <div className="relative bg-[#f5a047]/20">
     {banner?<img src={banner} alt="" style={{objectFit:event.banner_fit==="contain"?"contain":"cover",objectPosition:`${event.banner_position_x??50}% ${event.banner_position_y??50}%`}} className={event.banner_fit==="contain"?"block h-auto max-h-[52svh] w-full object-contain sm:h-[62vh] sm:max-h-none lg:h-[69vh]":"block h-[38svh] min-h-[208px] w-full object-cover sm:h-[62vh] lg:h-[69vh]"}/>:
     <div className="flex h-[37svh] min-h-[200px] items-center justify-center bg-[#f5a047]/40 text-sm sm:h-[62vh] lg:h-[69vh]">Event banner image</div>}
     {bannerControl&&<div className="absolute bottom-4 right-4">{bannerControl}</div>}
   </div>
   <div className="px-5 pb-14 pt-7 sm:px-10 sm:pt-10 lg:px-[6vw]">
     <div className="mb-7 border-b border-black/15 pb-6">
       <div className="min-w-0">{heading??<h1 className="text-3xl font-black leading-tight sm:text-5xl">{en&&event.title_en?event.title_en:event.title}</h1>}</div>
       <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
         <div className="min-w-0 space-y-2">
           {dateAndPlace??<div className="space-y-1 font-semibold"><p>{event.event_date} · {event.event_time.slice(0,5)}</p><p className="flex flex-wrap items-center gap-x-3 gap-y-1">{event.location||(en?"Venue to be confirmed":"Место уточняется")}{event.location?.trim()&&<a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold underline underline-offset-2">{en?"Open in Google Maps ↗":"Открыть в Google Maps ↗"}</a>}</p></div>}
         </div>
         {!heading&&(bookingAction?<button type="button" disabled={bookingDisabled} onClick={bookingAction} className="inline-flex min-h-12 items-center justify-center rounded-lg bg-black px-7 py-3 font-bold text-white disabled:opacity-50">{en?"Tickets →":"Билеты →"}</button>:<Link href={bookingHref??`/events/${event.slug}/book`} className="inline-flex min-h-12 items-center justify-center rounded-lg bg-black px-7 py-3 font-bold text-white">{en?"Tickets →":"Билеты →"}</Link>)}
       </div>
     </div>
     <div className="grid gap-7 md:grid-cols-[minmax(0,1fr)_minmax(0,0.82fr)] md:items-start md:gap-10">
       <section className="min-w-0">
         <h2 className="mb-3 text-xl font-black">{en?"About the event":"О мероприятии"}</h2>
         {description??<EventMarkdown text={(en&&event.description_en?event.description_en:event.description)||(en?"Description coming soon.":"Описание скоро появится.")} />}
       </section>
       <div className="relative rounded-lg bg-[#f5a047]/20">
         {detail?<img src={detail} alt="" style={{objectFit:event.detail_fit==="contain"?"contain":"cover",objectPosition:`${event.detail_position_x??50}% ${event.detail_position_y??50}%`}} className={event.detail_fit==="contain"?"block h-auto max-h-[75svh] w-full object-contain sm:h-[85vh] sm:max-h-none":"block h-[62svh] min-h-[280px] w-full bg-[#fffaf1] object-cover sm:h-[85vh]"}/>:
          <div className="flex h-[55svh] min-h-[280px] items-center justify-center sm:h-[85vh] px-4 text-center text-sm text-gray-600">Event photograph</div>}
         {imageControl&&<div className="absolute bottom-3 right-3">{imageControl}</div>}
       </div>
     </div>
     <div className="mt-8 border-t border-black/15 pt-7">
       {bookingAction?<button type="button" disabled={bookingDisabled} onClick={bookingAction} className="inline-flex min-h-12 items-center justify-center rounded-lg bg-black px-8 py-3 font-bold text-white disabled:opacity-50">{en?"Tickets →":"Билеты →"}</button>:
        <Link href={bookingHref??`/events/${event.slug}/book`} className="inline-flex min-h-12 items-center justify-center rounded-lg bg-black px-8 py-3 font-bold text-white">{en?"Tickets →":"Билеты →"}</Link>}
       <p className="mt-3 text-sm text-gray-600">Заказ еды станет доступен после оформления билетов.</p>
     </div>
   </div>
 </article>;
}
