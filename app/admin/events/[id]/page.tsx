"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type EventRecord = {
 id:string;slug:string;title:string;title_en:string|null;description:string|null;description_en:string|null;
 event_date:string;event_time:string;location:string|null;image_url:string|null;is_active:boolean;
};
type Ticket = {id:string;name:string;price_cents:number;currency:string;quantity_total:number;quantity_sold:number};
type Section = "details"|"images"|"tickets"|"seating";
const sections: {id:Section;label:string}[] = [{id:"details",label:"Details"},{id:"images",label:"Images"},{id:"tickets",label:"Tickets"},{id:"seating",label:"Seating"}];

export default function EventWorkspace() {
 const params=useParams<{id:string}>();
 const router=useRouter();
 const [event,setEvent]=useState<EventRecord|null>(null);
 const [tickets,setTickets]=useState<Ticket[]>([]);
 const [section,setSection]=useState<Section>("details");
 const [mode,setMode]=useState<"edit"|"preview">("preview");
 const [busy,setBusy]=useState(true);
 const [saving,setSaving]=useState(false);
 const [message,setMessage]=useState("");
 const [error,setError]=useState("");
 const [authorised,setAuthorised]=useState(false);

 useEffect(()=>{
  let active=true;
  async function load(){
   try {
    const {data:{user},error:authError}=await supabase.auth.getUser();
    if(authError||!user){router.replace("/admin/login");return;}
    const {data:membership,error:roleError}=await supabase.from("admin_users").select("role").eq("user_id",user.id).maybeSingle();
    if(roleError||!membership){router.replace("/admin/login");return;}
    const {data,error:dbError}=await supabase.from("events").select("id,slug,title,title_en,description,description_en,event_date,event_time,location,image_url,is_active").eq("id",params.id).single();
    if(dbError)throw dbError;
    const {data:ticketRows,error:ticketError}=await supabase.from("ticket_types").select("id,name,price_cents,currency,quantity_total,quantity_sold").eq("event_id",params.id);
    if(active){setAuthorised(true);setEvent(data as EventRecord);if(!ticketError)setTickets((ticketRows??[]) as Ticket[]);}
   }catch(e){if(active)setError(e instanceof Error?e.message:"Unable to load event.");}
   finally{if(active)setBusy(false);}
  }
  void load();
  return ()=>{active=false;};
 },[params.id,router]);

 function setField<K extends keyof EventRecord>(field:K,value:EventRecord[K]){
  setEvent(current=>current?{...current,[field]:value}:current);
  setMessage("");
 }
 async function save(){
  if(!event)return;
  if(!event.title.trim()||!event.event_date||!event.event_time){setError("Title, date and time are required.");return;}
  setSaving(true);setError("");setMessage("");
  const {error:saveError}=await supabase.from("events").update({
   title:event.title.trim(),title_en:event.title_en?.trim()||null,
   description:event.description?.trim()||null,description_en:event.description_en?.trim()||null,
   event_date:event.event_date,event_time:event.event_time,location:event.location?.trim()||null,
   image_url:event.image_url?.trim()||null,is_active:event.is_active,updated_at:new Date().toISOString()
  }).eq("id",event.id);
  if(saveError)setError(saveError.message);else setMessage("Changes saved.");
  setSaving(false);
 }

 if(busy)return <main className="min-h-[70vh] bg-[#fff2db] p-6" role="status">Loading event workspace…</main>;
 if(!authorised||!event)return <main className="min-h-[70vh] bg-[#fff2db] p-6" role="alert">{error||"Access unavailable"}</main>;
 const preview=<div className="overflow-hidden rounded-2xl border border-black/20 bg-white">
  {event.image_url?<img src={event.image_url} alt="" className="aspect-[16/9] w-full object-cover"/>:
    <div className="flex aspect-[16/9] items-center justify-center bg-[#f5a047]/25 px-4 text-center text-sm text-gray-600">Event image preview · Add a photo in Images</div>}
  <div className="space-y-4 p-5 sm:p-7">
   <p className="text-xs font-bold uppercase tracking-widest text-pink-700">Юморильник · Афиша</p>
   <h2 className="text-3xl font-black">{event.title||"Название мероприятия"}</h2>
   <p className="text-sm font-semibold">{event.event_date||"Дата"} · {event.event_time.slice(0,5)} · {event.location||"Место проведения"}</p>
   <p className="whitespace-pre-wrap text-sm leading-relaxed">{event.description||"Описание мероприятия появится здесь."}</p>
   <div className="rounded-xl bg-[#fff2db] p-4">
    <h3 className="font-black">Билеты</h3>
    {tickets.length? tickets.map(t=><p key={t.id} className="mt-2 text-sm">{t.name} · {new Intl.NumberFormat("en-NZ",{style:"currency",currency:t.currency.toUpperCase()}).format(t.price_cents/100)}</p>):
    <p className="mt-2 text-sm text-gray-600">Ticket types will appear here when added.</p>}
    <p className="mt-3 text-xs text-gray-500">Customer preview · Purchasing disabled</p>
   </div>
  </div>
 </div>;
 const fieldClass="mt-1 w-full rounded-lg border border-black/40 bg-white px-3 py-3 text-base";
 const editor=<div className="rounded-2xl border border-black/20 bg-white p-4 sm:p-6">
  <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
   {sections.map(s=><button key={s.id} type="button" onClick={()=>setSection(s.id)} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold ${section===s.id?"bg-black text-white":"bg-gray-100 text-black"}`}>{s.label}</button>)}
  </div>
  {section==="details"&&<div className="space-y-4">
   <label className="block text-sm font-semibold">Russian title<input className={fieldClass} value={event.title} onChange={e=>setField("title",e.target.value)}/></label>
   <label className="block text-sm font-semibold">English title<input className={fieldClass} value={event.title_en??""} onChange={e=>setField("title_en",e.target.value)}/></label>
   <label className="block text-sm font-semibold">Russian description<textarea rows={6} className={fieldClass} value={event.description??""} onChange={e=>setField("description",e.target.value)}/></label>
   <label className="block text-sm font-semibold">English description<textarea rows={5} className={fieldClass} value={event.description_en??""} onChange={e=>setField("description_en",e.target.value)}/></label>
   <div className="grid gap-3 sm:grid-cols-2">
    <label className="block text-sm font-semibold">Date<input type="date" className={fieldClass} value={event.event_date} onChange={e=>setField("event_date",e.target.value)}/></label>
    <label className="block text-sm font-semibold">Time<input type="time" className={fieldClass} value={event.event_time.slice(0,5)} onChange={e=>setField("event_time",e.target.value)}/></label>
   </div>
   <label className="block text-sm font-semibold">Venue<input className={fieldClass} value={event.location??""} onChange={e=>setField("location",e.target.value)}/></label>
   <label className="flex items-center gap-3 rounded-lg bg-[#fff2db] p-3 text-sm font-bold"><input type="checkbox" checked={event.is_active} onChange={e=>setField("is_active",e.target.checked)} className="h-5 w-5"/> Published</label>
  </div>}
  {section==="images"&&<div className="space-y-3"><h3 className="text-lg font-black">Event image</h3><p className="text-sm text-gray-600">Paste an image URL for now. Image uploads and multiple gallery images are the next implementation step.</p><label className="block text-sm font-semibold">Image URL<input type="url" className={fieldClass} value={event.image_url??""} onChange={e=>setField("image_url",e.target.value)} placeholder="https://…"/></label></div>}
  {section==="tickets"&&<div className="space-y-3"><h3 className="text-lg font-black">Ticket types</h3>{tickets.length?tickets.map(t=><p key={t.id} className="rounded-lg bg-gray-100 p-3 text-sm">{t.name} · {t.price_cents/100} {t.currency.toUpperCase()} · {t.quantity_sold}/{t.quantity_total} sold</p>):<p className="text-sm">No ticket types yet.</p>}<p className="text-sm text-gray-600">Ticket creation and editing will be enabled in the next milestone.</p></div>}
  {section==="seating"&&<div className="space-y-2"><h3 className="text-lg font-black">Seating</h3><p className="text-sm text-gray-600">Seat allocation and the New Year's seating map will be connected here in a later milestone.</p></div>}
  {error&&<p role="alert" className="mt-4 rounded bg-red-100 p-3 text-sm text-red-900">{error}</p>}
  {message&&<p role="status" className="mt-4 rounded bg-green-100 p-3 text-sm text-green-900">{message}</p>}
  <button type="button" disabled={saving} onClick={save} className="mt-6 w-full rounded-lg bg-black px-5 py-4 font-bold text-white disabled:opacity-50">{saving?"Saving…":"Save changes"}</button>
 </div>;

 return <main className="min-h-[80vh] bg-[#fff2db] px-4 py-7 text-black sm:px-8">
  <div className="mx-auto max-w-7xl">
   <Link href="/admin/events" className="text-sm font-bold underline">← All events</Link>
   <div className="mt-5 flex flex-wrap items-start justify-between gap-3">
    <div><p className="text-xs font-bold uppercase tracking-widest text-pink-700">Event workspace</p><h1 className="mt-1 text-2xl font-black sm:text-3xl">{event.title}</h1><p className="mt-1 text-sm">{event.is_active?"Published":"Draft"} · {event.slug}</p></div>
    <div className="flex rounded-lg border border-black p-1 lg:hidden"><button className={`rounded px-4 py-2 text-sm font-bold ${mode==="preview"?"bg-black text-white":""}`} onClick={()=>setMode("preview")}>Preview</button><button className={`rounded px-4 py-2 text-sm font-bold ${mode==="edit"?"bg-black text-white":""}`} onClick={()=>setMode("edit")}>Edit</button></div>
   </div>
   <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.1fr)] lg:items-start">
    <div className={mode==="edit"?"block":"hidden lg:block"}>{editor}</div>
    <div className={mode==="preview"?"block":"hidden lg:block"}><p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-600">Customer preview (Russian)</p>{preview}</div>
   </div>
  </div>
 </main>;
}
