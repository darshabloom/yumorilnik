import Link from "next/link";
import { supabaseServer } from "@/lib/supabaseServer";
export default async function EventsPage() {
 const today = new Date().toISOString().slice(0,10);
 const {data: events,error} = await supabaseServer.from("events").select("id,slug,title,event_date,event_time,location,image_url,event_type,external_url").eq("is_active",true).gte("event_date",today).order("event_date",{ascending:true});
 return <main className="min-h-screen bg-[#fffaf1] px-5 py-12 text-black sm:px-10 lg:px-[6vw]">
  <h1 className="text-4xl font-black sm:text-6xl">Афиша</h1>
  <p className="mt-3 text-lg">Ближайшие мероприятия Юморильника</p>
  {error?<p role="alert" className="mt-8">Не удалось загрузить афишу.</p>:!events?.length?<p className="mt-8 rounded-xl bg-white p-8">Скоро новые мероприятия!</p>:
  <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">{events.map(event=><Link key={event.id} href={event.event_type==="external"&&event.external_url?event.external_url:"/events/"+event.slug} target={event.event_type==="external"?"_blank":undefined} rel={event.event_type==="external"?"noopener noreferrer":undefined} className="overflow-hidden rounded-xl border bg-white hover:shadow-xl">
   {event.image_url?<img src={event.image_url} alt="" className="aspect-[16/10] w-full object-cover"/>:<div className="flex aspect-[16/10] items-center justify-center bg-[#f5a047]/30">Юморильник</div>}
   <div className="space-y-3 p-5"><p className="text-sm font-semibold">{event.event_date} · {event.event_time.slice(0,5)}</p><h2 className="text-2xl font-black">{event.title}</h2><p>{event.location}</p><p className="font-bold underline">{event.event_type==="external"?"External tickets ↗":"Подробнее →"}</p></div>
  </Link>)}</div>}
 </main>;
}