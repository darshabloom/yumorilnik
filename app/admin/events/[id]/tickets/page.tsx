"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Event = {id:string;slug:string;title:string;image_url:string|null};
type Ticket = {id:string;event_id:string;name:string;description:string|null;price_cents:number;currency:string;quantity_total:number;quantity_sold:number;is_active:boolean};
type Form = {name:string;description:string;price:string;quantity:string;active:boolean};
const empty:Form={name:"",description:"",price:"",quantity:"100",active:true};
function initial(t:Ticket):Form{return {name:t.name,description:t.description??"",price:(t.price_cents/100).toFixed(2),quantity:String(t.quantity_total),active:t.is_active};}
const price=(t:Ticket)=>new Intl.NumberFormat("en-NZ",{style:"currency",currency:t.currency.toUpperCase()}).format(t.price_cents/100);

export default function TicketEditor(){
 const {id}=useParams<{id:string}>();
 const router=useRouter();
 const [event,setEvent]=useState<Event|null>(null);
 const [tickets,setTickets]=useState<Ticket[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [editing,setEditing]=useState<string|null>(null);
 const [form,setForm]=useState<Form>(empty);
 const [saving,setSaving]=useState(false);
 const [preview,setPreview]=useState(false);

 useEffect(()=>{
  let active=true;
  async function load(){
   try{
    const {data:{user},error:authError}=await supabase.auth.getUser();
    if(authError||!user){router.replace("/admin/login");return;}
    const {data:admin,error:roleError}=await supabase.from("admin_users").select("role").eq("user_id",user.id).maybeSingle();
    if(roleError||!admin){router.replace("/admin/login");return;}
    const [ev,ts]=await Promise.all([
      supabase.from("events").select("id,slug,title,image_url").eq("id",id).single(),
      supabase.from("ticket_types").select("id,event_id,name,description,price_cents,currency,quantity_total,quantity_sold,is_active").eq("event_id",id).order("created_at",{ascending:true})
    ]);
    if(ev.error)throw ev.error;
    if(ts.error)throw ts.error;
    if(active){setEvent(ev.data as Event);setTickets((ts.data??[]) as Ticket[]);}
   }catch(e){if(active)setError(e instanceof Error?e.message:"Unable to load tickets");}
   finally{if(active)setLoading(false);}
  }
  void load();return()=>{active=false;};
 },[id,router]);
 function open(t?:Ticket){
   setEditing(t?.id??"new");setForm(t?initial(t):empty);setError("");setNotice("");
 }
 async function save(){
  if(!event)return;
  const p=Number(form.price),q=Number(form.quantity);
  if(!form.name.trim()||!Number.isFinite(p)||p<0||!Number.isFinite(q)||!Number.isInteger(q)||q<0||form.price.trim()===""||form.quantity.trim()===""){setError("Enter a name, valid price and whole-number capacity.");return;}
  const current=tickets.find(t=>t.id===editing);
  if(current && q<current.quantity_sold){setError("Capacity cannot be smaller than tickets already sold.");return;}
  setSaving(true);setError("");
  const values={name:form.name.trim(),description:form.description.trim()||null,price_cents:Math.round(p*100),quantity_total:q,is_active:form.active};
  try{
    if(current){
      const {data,error}=await supabase.from("ticket_types").update(values).eq("id",current.id).eq("event_id",id).select("id,event_id,name,description,price_cents,currency,quantity_total,quantity_sold,is_active").single();
      if(error)throw error;
      setTickets(previous=>previous.map(t=>t.id===current.id?data as Ticket:t));
    }else{
      const {data,error}=await supabase.from("ticket_types").insert({...values,event_id:id,currency:"NZD",quantity_sold:0}).select("id,event_id,name,description,price_cents,currency,quantity_total,quantity_sold,is_active").single();
      if(error)throw error;
      setTickets(previous=>[...previous,data as Ticket]);
    }
    setEditing(null);setNotice("Ticket type saved.");
  }catch(e){setError(e instanceof Error?e.message:"Saving failed.");}
  finally{setSaving(false);}
 }
 async function toggle(ticket:Ticket){
   setError("");setNotice("");
   const {error}=await supabase.from("ticket_types").update({is_active:!ticket.is_active}).eq("id",ticket.id).eq("event_id",id);
   if(error){setError(error.message);return;}
   setTickets(prev=>prev.map(t=>t.id===ticket.id?{...t,is_active:!t.is_active}:t));
   setNotice("Availability updated.");
 }
 if(loading)return <main className="min-h-[75vh] bg-[#fffaf1] p-6">Loading ticket editor…</main>;
 if(!event)return <main role="alert" className="min-h-[75vh] bg-[#fffaf1] p-6">{error||"Event not found."}</main>;
 const active=tickets.filter(t=>t.is_active);
 const shown=preview?active:tickets;
 return <main className="min-h-screen bg-[#fffaf1] pb-28 text-black">
   <div className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-2 border-b border-black/15 bg-[#fff2db] px-4 py-3 sm:px-8">
    <Link href={`/admin/events/${id}`} className="text-sm font-bold underline">← Event page</Link>
    <div className="flex items-center gap-2">
      <span className="text-sm font-semibold">Tickets editor</span>
      <button onClick={()=>setPreview(!preview)} className="rounded-lg border border-black px-3 py-2 text-sm font-bold">{preview?"Edit":"Preview"}</button>
    </div>
   </div>
   {event.image_url?<img src={event.image_url} alt="" className="h-36 w-full object-cover sm:h-60"/>:<div className="h-36 bg-[#f5a047]/25"/>}
   <div className="px-5 py-8 sm:px-10 lg:px-[6vw]">
     <h1 className="text-3xl font-black sm:text-5xl">{event.title}</h1>
     <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
       <section>
         <div className="mb-5 flex items-center justify-between gap-3">
           <h2 className="text-2xl font-black">Билеты</h2>
           {!preview&&<button onClick={()=>open()} className="rounded-lg bg-black px-4 py-3 text-sm font-bold text-white">+ Add ticket</button>}
         </div>
         {shown.length===0?<p className="rounded-xl border bg-white p-5">No ticket types yet. Add the first one.</p>:
          shown.map(t=><div key={t.id} className="mb-3 rounded-xl border border-black/15 bg-white p-4">
           <div className="flex items-start justify-between gap-3">
             <div className="min-w-0"><h3 className="text-xl font-bold">{t.name}</h3>{t.description&&<p className="mt-1 whitespace-pre-wrap text-sm">{t.description}</p>}<p className="mt-2 font-bold">{price(t)}</p>
               {!preview&&<p className="mt-1 text-xs text-gray-600">{t.quantity_sold} sold · {Math.max(0,t.quantity_total-t.quantity_sold)} remaining · {t.is_active?"Visible":"Hidden"}</p>}
             </div>
             {!preview&&<button onClick={()=>open(t)} className="rounded-lg border border-black px-3 py-2 text-sm font-bold">Edit</button>}
             {preview&&<div className="flex items-center gap-2 text-sm"><button disabled className="h-9 w-9 rounded border opacity-40">−</button>0<button disabled className="h-9 w-9 rounded border opacity-40">+</button></div>}
           </div>
           {!preview&&<button onClick={()=>void toggle(t)} className="mt-3 text-sm font-semibold underline">{t.is_active?"Hide ticket type":"Make ticket visible"}</button>}
          </div>)}
         {error&&<p role="alert" className="my-4 rounded bg-red-100 p-3 text-sm text-red-800">{error}</p>}
         {notice&&<p role="status" className="my-4 rounded bg-green-100 p-3 text-sm text-green-800">{notice}</p>}
       </section>
       <section>
         <h2 className="mb-5 text-2xl font-black">Рассадка</h2>
         <div className="flex min-h-80 flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-black/20 bg-white p-6 text-center">
           <div className="rounded-lg bg-[#f5a047]/40 px-10 py-3 font-bold">Сцена</div>
           <p className="font-bold">Seating map setup is next</p>
           <p className="max-w-sm text-sm text-gray-600">Ticket quantities can be configured now. They are not connected to physical seats or tables yet.</p>
         </div>
       </section>
     </div>
   </div>
   {editing!==null&&!preview&&<div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center" onMouseDown={e=>{if(e.target===e.currentTarget&&!saving)setEditing(null);}}>
     <form onSubmit={e=>{e.preventDefault();void save();}} className="max-h-[90dvh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-2xl sm:p-7">
       <div className="mb-5 flex items-center justify-between"><h2 className="text-2xl font-black">{editing==="new"?"Add ticket":"Edit ticket"}</h2><button type="button" onClick={()=>setEditing(null)} aria-label="Close" className="text-2xl">×</button></div>
       <div className="space-y-4">
        <label className="block text-sm font-bold">Ticket name<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Adult / Child / VIP" className="mt-1 w-full rounded-lg border border-black/30 p-3"/></label>
        <label className="block text-sm font-bold">Description (optional)<textarea rows={3} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} className="mt-1 w-full rounded-lg border border-black/30 p-3"/></label>
        <div className="grid grid-cols-2 gap-3">
         <label className="block text-sm font-bold">Price (NZD)<input required type="number" min="0" step="0.01" value={form.price} onChange={e=>setForm({...form,price:e.target.value})} className="mt-1 w-full rounded-lg border border-black/30 p-3"/></label>
         <label className="block text-sm font-bold">Total quantity<input required type="number" min="0" step="1" value={form.quantity} onChange={e=>setForm({...form,quantity:e.target.value})} className="mt-1 w-full rounded-lg border border-black/30 p-3"/></label>
        </div>
        <label className="flex items-center gap-3 rounded-lg bg-[#fff2db] p-3 text-sm font-bold"><input type="checkbox" checked={form.active} onChange={e=>setForm({...form,active:e.target.checked})} className="h-5 w-5"/> Visible to customers</label>
       </div>
       {error&&<p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
       <div className="mt-6 flex gap-3"><button disabled={saving} type="submit" className="flex-1 rounded-lg bg-black px-5 py-4 font-bold text-white disabled:opacity-50">{saving?"Saving…":"Save ticket"}</button><button type="button" onClick={()=>setEditing(null)} className="rounded-lg border px-4">Cancel</button></div>
     </form>
   </div>}
 </main>;
}
