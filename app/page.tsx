import LocalizedText from "@/components/LocalizedText";
import Image from "next/image";
import Link from "next/link";
import { supabaseServer } from "@/lib/supabaseServer";

export default async function HomePage() {
  const today = new Date().toISOString().slice(0,10);
  const {data:events} = await supabaseServer.from("events").select("id,slug,title,title_en,event_date,event_time,location,image_url,event_type,external_url").eq("is_active",true).gte("event_date",today).order("event_date",{ascending:true}).limit(3);
  return (
    <main className="min-h-screen bg-[#f5a047] text-black">
      <section className="relative h-[360px] overflow-hidden bg-black md:h-[620px]">
        <Image
          src="/images/home/hero.jpg"
          alt="Юморильник"
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/85 via-black/25 to-transparent" aria-hidden="true" />
        <div className="absolute inset-x-0 bottom-0 px-6 pb-7 pt-12 text-white sm:px-10 sm:pb-10 lg:px-16 lg:pb-14">
          <div className="mx-auto max-w-7xl">
            <p className="mb-3 inline-block rounded bg-black/85 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[#ffd08a] sm:text-sm">
              <LocalizedText ru="Юморильник · Окленд" en="Yumorilnik · Auckland"/>
            </p>
            <h1 className="max-w-2xl text-3xl font-black leading-tight drop-shadow-lg sm:text-5xl lg:text-6xl">
              <LocalizedText ru="Юмор, люди, истории." en="Humour, people, stories."/>
            </h1>
            <p className="mt-3 max-w-xl text-sm font-medium leading-relaxed drop-shadow-lg sm:text-lg">
              <LocalizedText ru="Встречаемся, смеёмся и делимся тем, что интересно." en="Getting together, laughing and sharing what matters."/>
            </p>
          </div>
        </div>
      </section>

      <section className="bg-[#fffaf1] px-5 py-14 text-black sm:px-10 lg:px-[6vw]">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-sm font-bold uppercase tracking-wider text-pink-700"><LocalizedText ru="Скоро" en="Coming soon"/></p><h2 className="mt-2 text-3xl font-black sm:text-5xl"><LocalizedText ru="Ближайшие мероприятия" en="Upcoming events"/></h2></div>
          <Link href="/events" className="font-bold underline"><LocalizedText ru="Вся афиша →" en="All events →"/></Link>
        </div>
        {events?.length?<div className="grid gap-6 md:grid-cols-3">
          {events.map(event=><Link key={event.id} href={event.event_type==="external"&&event.external_url?event.external_url:"/events/"+event.slug} target={event.event_type==="external"?"_blank":undefined} rel={event.event_type==="external"?"noopener noreferrer":undefined} className="overflow-hidden rounded-xl border border-black/15 bg-white transition-shadow hover:shadow-lg">
            {event.image_url?<img src={event.image_url} alt="" className="aspect-[16/10] w-full object-cover"/>:<div className="flex aspect-[16/10] items-center justify-center bg-[#f5a047]/30">Юморильник</div>}
            <div className="space-y-2 p-5"><p className="text-sm font-semibold">{event.event_date} · {event.event_time.slice(0,5)}</p><h3 className="text-2xl font-black"><LocalizedText ru={event.title} en={event.title_en||event.title}/></h3><p>{event.location}</p><p className="pt-2 font-bold underline">{event.event_type==="external"?"External tickets ↗":"<LocalizedText ru="Подробнее →" en="Details →"/>"}</p></div>
          </Link>)}
        </div>:<p className="rounded-xl border border-black/15 bg-white p-6"><LocalizedText ru="Следите за афишей — новые мероприятия скоро появятся!" en="Keep an eye on our events — more coming soon!"/></p>}
      </section>
    </main>
  );
}