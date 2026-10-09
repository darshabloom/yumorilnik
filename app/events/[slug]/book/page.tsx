import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabaseServer";

export default async function BookEvent({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;
 const {data:event,error}=await supabaseServer.from("events").select("id,slug,title,image_url,is_active").eq("slug",slug).eq("is_active",true).maybeSingle();
 if(error)throw new Error("Unable to load event.");
 if(!event)notFound();
 return <main className="min-h-[70vh] bg-[#fff2db] pb-28 text-black">
   <div className="mx-auto max-w-5xl">
    {event.image_url?<img src={event.image_url} alt="" className="h-48 w-full object-cover sm:h-64"/>:<div className="h-44 bg-[#f5a047]/40"/>}
    <div className="space-y-5 px-5 py-8">
      <Link href={`/events/${event.slug}`} className="text-sm font-bold underline">← Back to event</Link>
      <h1 className="text-3xl font-black">{event.title} · Билеты</h1>
      <p className="rounded-lg border border-black/20 bg-white p-5">Ticket selection and interactive seating map are under development. Purchases are disabled until booking and payment testing is complete.</p>
      <section className="rounded-lg border border-black/20 bg-white p-5"><h2 className="text-xl font-bold">Tickets</h2><p className="mt-2 text-sm">Ticket quantities will appear here.</p></section>
      <section className="rounded-lg border border-black/20 bg-white p-5"><h2 className="text-xl font-bold">Seating</h2><p className="mt-2 text-sm">Interactive venue map coming next.</p></section>
    </div>
   </div>
   <div className="fixed inset-x-0 bottom-0 border-t border-black/20 bg-white px-5 py-3 shadow-lg"><div className="mx-auto flex max-w-5xl items-center justify-between gap-4"><div><p className="text-xs">0 tickets · 0 seats selected</p><p className="text-lg font-black">$0.00</p></div><button disabled className="rounded-lg bg-black px-5 py-3 font-bold text-white opacity-50">Continue →</button></div></div>
 </main>;
}
