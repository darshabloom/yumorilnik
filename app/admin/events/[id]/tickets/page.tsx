"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {useSiteLanguage} from "@/lib/useSiteLanguage";

type Event = {id:string;slug:string;title:string;image_url:string|null;booking_image_url:string|null;booking_image_fit:string;booking_image_position_x:number;booking_image_position_y:number;seating_mode:string;table_booking_mode:string;adult_seat_required:boolean;pricing_model:string;child_unseated_price_cents:number};
type Ticket = {id:string;event_id:string;name:string;description:string|null;price_cents:number;currency:string;quantity_total:number;quantity_sold:number;is_active:boolean;show_remaining:boolean};
type Form = {name:string;description:string;price:string;quantity:string;active:boolean;showRemaining:boolean};
const empty:Form={name:"",description:"",price:"",quantity:"100",active:true,showRemaining:false};
function initial(t:Ticket):Form{return {name:t.name,description:t.description??"",price:(t.price_cents/100).toFixed(2),quantity:String(t.quantity_total),active:t.is_active,showRemaining:t.show_remaining};}
const price=(t:Ticket)=>new Intl.NumberFormat("en-NZ",{style:"currency",currency:t.currency.toUpperCase()}).format(t.price_cents/100);

export default function TicketEditor(){
 const {id}=useParams<{id:string}>();
 const router=useRouter();
 const en=useSiteLanguage()==="en";
 const [event,setEvent]=useState<Event|null>(null);
 const [tickets,setTickets]=useState<Ticket[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [editing,setEditing]=useState<string|null>(null);
 const [form,setForm]=useState<Form>(empty);
 const [saving,setSaving]=useState(false);
 const [preview,setPreview]=useState(false);
 const [modeSaving,setModeSaving]=useState(false);
 const [imageOpen,setImageOpen]=useState(false);
 const [imageUploading,setImageUploading]=useState(false);
 const [imageSaving,setImageSaving]=useState(false);

 useEffect(()=>{
  let active=true;
  async function load(){
   try{
    const {data:{user},error:authError}=await supabase.auth.getUser();
    if(authError||!user){router.replace("/admin/login");return;}
    const {data:admin,error:roleError}=await supabase.from("admin_users").select("role").eq("user_id",user.id).maybeSingle();
    if(roleError||!admin){router.replace("/admin/login");return;}
    const [ev,ts]=await Promise.all([
      supabase.from("events").select("id,slug,title,image_url,booking_image_url,booking_image_fit,booking_image_position_x,booking_image_position_y,seating_mode,table_booking_mode,adult_seat_required,pricing_model,child_unseated_price_cents").eq("id",id).single(),
      supabase.from("ticket_types").select("id,event_id,name,description,price_cents,currency,quantity_total,quantity_sold,is_active,show_remaining").eq("event_id",id).order("created_at",{ascending:true})
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
  const values={name:form.name.trim(),description:form.description.trim()||null,price_cents:Math.round(p*100),quantity_total:q,is_active:form.active,show_remaining:form.showRemaining};
  try{
    if(current){
      const {data,error}=await supabase.from("ticket_types").update(values).eq("id",current.id).eq("event_id",id).select("id,event_id,name,description,price_cents,currency,quantity_total,quantity_sold,is_active,show_remaining").single();
      if(error)throw error;
      setTickets(previous=>previous.map(t=>t.id===current.id?data as Ticket:t));
    }else{
      const {data,error}=await supabase.from("ticket_types").insert({...values,event_id:id,currency:"NZD",quantity_sold:0}).select("id,event_id,name,description,price_cents,currency,quantity_total,quantity_sold,is_active,show_remaining").single();
      if(error)throw error;
      setTickets(previous=>[...previous,data as Ticket]);
    }
    setEditing(null);setNotice("Ticket type saved.");
  }catch(e){setError(e instanceof Error?e.message:"Saving failed.");}
  finally{setSaving(false);}
 }
 async function setBannerSettings(patch:Partial<Event>){
   if(!event)return;
   const previous=event;
   setEvent({...event,...patch});
   setImageSaving(true);setError("");
   const {error:e}=await supabase.from("events").update(patch).eq("id",event.id);
   if(e){setEvent(previous);setError("Image settings not saved: "+e.message);}
   else setNotice("Booking banner saved.");
   setImageSaving(false);
 }
 async function uploadBookingImage(file:File|undefined){
   if(!file||!event)return;
   if(!["image/jpeg","image/png","image/webp","image/gif"].includes(file.type)){setError("Use JPG, PNG, WebP or GIF.");return;}
   if(file.size>10*1024*1024){setError("Image must be under 10 MB.");return;}
   setImageUploading(true);setError("");
   try{
     const ext=file.type==="image/jpeg"?"jpg":file.type==="image/png"?"png":file.type==="image/webp"?"webp":"gif";
     const key=`${event.id}/booking-${crypto.randomUUID()}.${ext}`;
     const {error:uploadError}=await supabase.storage.from("event-images").upload(key,file,{upsert:false,contentType:file.type});
     if(uploadError)throw uploadError;
     const {data}=supabase.storage.from("event-images").getPublicUrl(key);
     const {error:saveError}=await supabase.from("events").update({booking_image_url:data.publicUrl}).eq("id",event.id);
     if(saveError)throw saveError;
     setEvent({...event,booking_image_url:data.publicUrl});
     setNotice("Booking image uploaded and saved.");setImageOpen(false);
   }catch(e){setError(e instanceof Error?e.message:"Upload failed");}
   finally{setImageUploading(false);}
 }
 async function changeTableBookingMode(mode:"whole_table"|"individual_seats"){
  if(!event)return;
  setModeSaving(true);setError("");setNotice("");
  const {error}=await supabase.from("events").update({table_booking_mode:mode}).eq("id",event.id);
  if(error)setError(error.message);
  else {setEvent({...event,table_booking_mode:mode});setNotice("Table booking preference saved.");}
  setModeSaving(false);
 }
 async function changeMode(mode:string){
  if(!event)return;
  setModeSaving(true);setError("");setNotice("");
  const {error}=await supabase.from("events").update({seating_mode:mode}).eq("id",event.id);
  if(error)setError(error.message);
  else {setEvent({...event,seating_mode:mode});setNotice("Seating type saved. Seat/table mapping comes next.");}
  setModeSaving(false);
 }
 async function toggle(ticket:Ticket){
   setError("");setNotice("");
   const {error}=await supabase.from("ticket_types").update({is_active:!ticket.is_active}).eq("id",ticket.id).eq("event_id",id);
   if(error){setError(error.message);return;}
   setTickets(prev=>prev.map(t=>t.id===ticket.id?{...t,is_active:!t.is_active}:t));
   setNotice("Availability updated.");
 }
 if(loading)return <main className="min-h-[75vh] bg-[#fffaf1] p-6">{en?"Loading ticket editor…":"Загрузка редактора билетов…"}</main>;
 if(!event)return <main role="alert" className="min-h-[75vh] bg-[#fffaf1] p-6">{error||"Event not found."}</main>;
 const active=tickets.filter(t=>t.is_active);
 const shown=preview?active:tickets;
 return <main className="min-h-screen bg-[#fffaf1] pb-28 text-black">
   <div className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-2 border-b border-black/15 bg-[#fff2db] px-4 py-3 sm:px-8">
    <Link href={`/admin/events/${id}`} className="text-sm font-bold underline">{en?"← Event page":"← Страница мероприятия"}</Link>
    <div className="flex items-center gap-2">
      <span className="text-sm font-semibold">{en?"Tickets editor":"Редактор билетов"}</span>
      <button onClick={()=>setPreview(!preview)} className="rounded-lg border border-black px-3 py-2 text-sm font-bold">{preview?"Edit":"Preview"}</button>
    </div>
   </div>
   <div className="relative bg-[#fffaf1]">
     {(event.booking_image_url||event.image_url)?<img src={event.booking_image_url||event.image_url||""} alt="" className="h-36 w-full sm:h-48" style={{objectFit:event.booking_image_fit==="contain"?"contain":"cover",objectPosition:`${event.booking_image_position_x}% ${event.booking_image_position_y}%`}}/>:<div className="h-36 bg-[#f5a047]/25 sm:h-48"/>}
     {!preview&&<button type="button" onClick={()=>setImageOpen(v=>!v)} className="absolute bottom-3 right-3 rounded-lg border border-black/20 bg-white px-4 py-2 text-sm font-bold shadow">{en?"Change image":"Изменить изображение"}</button>}
     {imageOpen&&!preview&&<div className="absolute bottom-14 right-3 z-40 w-[min(390px,calc(100vw-24px))] space-y-3 rounded-xl border border-black/15 bg-white p-4 shadow-xl">
       <div className="flex items-center justify-between"><h2 className="font-bold">{en?"Booking page image":"Изображение страницы бронирования"}</h2><button type="button" aria-label="Close image settings" onClick={()=>setImageOpen(false)}>✕</button></div>
       <label className="block cursor-pointer rounded-lg border-2 border-dashed border-black/30 bg-[#fff2db] p-4 text-center text-sm font-bold">
         {imageUploading?(en?"Uploading…":"Загрузка…"):(en?"Upload image from device":"Загрузить изображение")}
         <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={imageUploading} className="sr-only" onChange={e=>{void uploadBookingImage(e.target.files?.[0]);e.target.value="";}}/>
       </label>
       <p className="text-xs text-gray-600">{en?"JPG, PNG, WebP or GIF · max 10 MB":"JPG, PNG, WebP или GIF · до 10 МБ"}</p>
       <div className="flex gap-2">
         <button type="button" onClick={()=>void setBannerSettings({booking_image_fit:"cover"})} className={`flex-1 rounded border px-3 py-2 text-sm font-bold ${event.booking_image_fit==="cover"?"bg-black text-white":""}`}>{en?"Fill / crop":"Заполнить / обрезать"}</button>
         <button type="button" onClick={()=>void setBannerSettings({booking_image_fit:"contain"})} className={`flex-1 rounded border px-3 py-2 text-sm font-bold ${event.booking_image_fit==="contain"?"bg-black text-white":""}`}>{en?"Fit entire image":"Показать целиком"}</button>
       </div>
       <label className="block text-sm font-semibold">Move horizontally · {event.booking_image_position_x}%<input type="range" min="0" max="100" value={event.booking_image_position_x} onChange={e=>setEvent(old=>old?{...old,booking_image_position_x:Number(e.target.value)}:old)} onPointerUp={()=>void setBannerSettings({booking_image_position_x:event.booking_image_position_x})} onKeyUp={()=>void setBannerSettings({booking_image_position_x:event.booking_image_position_x})} className="w-full"/></label>
       <label className="block text-sm font-semibold">Move vertically · {event.booking_image_position_y}%<input type="range" min="0" max="100" value={event.booking_image_position_y} onChange={e=>setEvent(old=>old?{...old,booking_image_position_y:Number(e.target.value)}:old)} onPointerUp={()=>void setBannerSettings({booking_image_position_y:event.booking_image_position_y})} onKeyUp={()=>void setBannerSettings({booking_image_position_y:event.booking_image_position_y})} className="w-full"/></label>
       {imageSaving&&<p role="status" className="text-xs">{en?"Saving…":"Сохранение…"}</p>}
       <button type="button" className="text-sm font-semibold underline" onClick={()=>void setBannerSettings({booking_image_url:null})}>{en?"Use main event image":"Использовать основное изображение"}</button>
     </div>}
   </div>
   <div className="px-5 py-8 sm:px-10 lg:px-[6vw]">
     <h1 className="text-3xl font-black sm:text-5xl">{event.title}</h1>
     <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
       <section>
         <div className="mb-5 flex items-center justify-between gap-3">
           <h2 className="text-2xl font-black">{en?"Билеты":"Tickets"}</h2>
           {!preview&&<button onClick={()=>open()} className="rounded-lg bg-black px-4 py-3 text-sm font-bold text-white">{en?"+ Add ticket":"+ Добавить билет"}</button>}
         </div>
         {shown.length===0?<p className="rounded-xl border bg-white p-5">{en?"No ticket types yet. Add the first one.":"Типов билетов ещё нет. Добавьте первый."}</p>:
          shown.map(t=><div key={t.id} className="mb-3 rounded-xl border border-black/15 bg-white p-4">
           <div className="flex items-start justify-between gap-3">
             <div className="min-w-0"><h3 className="text-xl font-bold">{t.name}</h3>{t.description&&<p className="mt-1 whitespace-pre-wrap text-sm">{t.description}</p>}<p className="mt-2 font-bold">{price(t)}</p>
               {!preview&&<p className="mt-1 text-xs text-gray-600">{t.quantity_sold} sold · {Math.max(0,t.quantity_total-t.quantity_sold)} remaining · {t.is_active?(en?"Visible":"Виден"):(en?"Hidden":"Скрыт")} · {t.show_remaining?(en?"Customer count shown":"Остаток виден"):(en?"Customer count hidden":"Остаток скрыт")}</p>}
             </div>
             {!preview&&<button onClick={()=>open(t)} className="rounded-lg border border-black px-3 py-2 text-sm font-bold">{en?"Edit":"Редактировать"}</button>}
             {preview&&<div className="flex items-center gap-2 text-sm"><button disabled className="h-9 w-9 rounded border opacity-40">−</button>0<button disabled className="h-9 w-9 rounded border opacity-40">+</button></div>}
           </div>
           {!preview&&<button onClick={()=>void toggle(t)} className="mt-3 text-sm font-semibold underline">{t.is_active?(en?"Hide ticket type":"Скрыть тип билета"):(en?"Make ticket visible":"Показать тип билета")}</button>}
          </div>)}
         {error&&<p role="alert" className="my-4 rounded bg-red-100 p-3 text-sm text-red-800">{error}</p>}
         {notice&&<p role="status" className="my-4 rounded bg-green-100 p-3 text-sm text-green-800">{notice}</p>}
       </section>
       <section>
         <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-black">{en?"Рассадка":"Seating"}</h2>{!preview&&<Link href={`/admin/events/${id}/seating`} className="rounded-lg bg-black px-4 py-3 text-sm font-bold text-white">{en?"Edit seating map →":"Редактировать схему зала →"}</Link>}</div>
         {!preview&&<div className="mb-5 rounded-xl border bg-white p-4">
           <p className="mb-3 font-bold">{en?"Seating type for this event":"Тип рассадки для мероприятия"}</p>
           <div className="space-y-3">
             {([{id:"general_admission",title:en?"General admission":"Вход без мест",desc:en?"Tickets without assigned seats":"Билеты без закреплённых мест"},{id:"assigned_seats",title:en?"Individual seats":"Отдельные места",desc:en?"Visitors choose numbered seats":"Гости выбирают нумерованные места"},{id:"tables",title:en?"Table bookings":"Бронирование столов",desc:en?"Visitors book tables; capacity rules are configured next":"Гости бронируют столы"}]).map(option=><label key={option.id} className="flex cursor-pointer items-start gap-3 rounded-lg border border-black/15 p-3">
               <input type="radio" name="seating_mode" value={option.id} checked={event.seating_mode===option.id} disabled={modeSaving} onChange={()=>void changeMode(option.id)} className="mt-1 h-4 w-4"/>
               <span><strong className="block">{option.title}</strong><span className="text-sm text-gray-600">{option.desc}</span></span>
             </label>)}
           </div>
           {event.seating_mode==="tables"&&<fieldset className="mt-4 rounded-lg bg-[#fff2db] p-4">
             <legend className="font-bold">{en?"How can customers book a table?":"Как гости могут бронировать стол?"}</legend>
             <div className="mt-2 space-y-3">
               <label className="flex items-start gap-3"><input type="radio" name="table_booking_mode" checked={event.table_booking_mode==="whole_table"} disabled={modeSaving} onChange={()=>void changeTableBookingMode("whole_table")} className="mt-1"/> <span><strong className="block">{en?"Entire tables":"Стол целиком"}</strong><span className="text-sm text-gray-600">{en?"One booking reserves every place at that table.":"Одно бронирование включает все места за столом."}</span></span></label>
               <label className="flex items-start gap-3"><input type="radio" name="table_booking_mode" checked={event.table_booking_mode==="individual_seats"} disabled={modeSaving} onChange={()=>void changeTableBookingMode("individual_seats")} className="mt-1"/> <span><strong className="block">{en?"Individual seats at tables":"Отдельные места за столом"}</strong><span className="text-sm text-gray-600">{en?"Guests choose their seats, and may share a table.":"Гости выбирают места и могут сидеть с другими гостями."}</span></span></label>
             </div>
           </fieldset>}
           {!preview&&event.seating_mode!=="general_admission"&&<div className="mt-4 rounded-lg border bg-white p-4"><label className="block text-sm font-semibold">{en?"Seat pricing model":"Модель ценообразования мест"}<select value={event.pricing_model} disabled={modeSaving} onChange={async e=>{const pricing_model=e.target.value;setModeSaving(true);const {error:saveError}=await supabase.from("events").update({pricing_model}).eq("id",id);if(saveError)setError(saveError.message);else setEvent(old=>old?{...old,pricing_model}:old);setModeSaving(false)}} className="mt-2 w-full rounded-lg border p-3"><option value="admission_plus_seat">{en?"Admission + seat surcharge (older events)":"Входной билет + доплата за место (старые мероприятия)"}</option><option value="zone_full_seat">{en?"Seat price includes adult admission (zone pricing)":"Цена места включает вход взрослого (цены по зонам)"}</option></select></label>{event.pricing_model==="zone_full_seat"&&<p className="mt-2 text-sm text-gray-600">{en?"Adult quantity determines reserved seats; the selected zones determine adult prices. Child admission is $30 per child, with optional full-price reserved seats.":"Число взрослых определяет обязательные места; цена зависит от выбранной зоны. Детский вход — $30, дополнительное место оплачивается по полной цене."}</p>}</div>}
           {event.seating_mode!=="general_admission"&&<label className="mt-4 flex items-start gap-3 rounded-lg border border-black/15 bg-[#fff2db] p-4">
             <input type="checkbox" checked={event.adult_seat_required} disabled={modeSaving} onChange={async e=>{
               const value=e.target.checked;setModeSaving(true);setError("");
               const {error:saveError}=await supabase.from("events").update({adult_seat_required:value}).eq("id",id);
               if(saveError)setError(saveError.message);else{setEvent(old=>old?{...old,adult_seat_required:value}:old);setNotice("Adult seat requirement saved.");}
               setModeSaving(false);
             }} className="mt-1 h-5 w-5"/>
             <span><strong className="block">{en?"Require a reserved seat for every adult":"Каждому взрослому нужно забронированное место"}</strong><span className="text-sm text-gray-600">{en?"If enabled, customers must select at least as many seats as adult tickets. Child seats remain optional. Does not affect other events.":"При включении каждому взрослому требуется место. Места для детей необязательны. Настройка относится только к этому мероприятию."}</span></span>
           </label>}
           <p className="mt-3 text-xs text-gray-600">{en?"Changing the mode does not create or reserve seats. Capacity and layout setup are coming next.":"Изменение режима не создаёт и не бронирует места."}</p>
         </div>}
         <div className="flex min-h-80 flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-black/20 bg-white p-6 text-center">
           <div className="rounded-lg bg-[#f5a047]/40 px-10 py-3 font-bold">Сцена</div>
           <p className="font-bold">{en?"Seating map setup is next":"Настройка схемы зала — следующий шаг"}</p>
           <p className="max-w-sm text-sm text-gray-600">{en?"Ticket quantities can be configured now. They are not connected to physical seats or tables yet.":"Количество билетов можно настроить сейчас. Пока оно не привязано к физическим местам или столам."}</p>
         </div>
       </section>
     </div>
   </div>
   {editing!==null&&!preview&&<div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center" onMouseDown={e=>{if(e.target===e.currentTarget&&!saving)setEditing(null);}}>
     <form onSubmit={e=>{e.preventDefault();void save();}} className="max-h-[90dvh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-2xl sm:p-7">
       <div className="mb-5 flex items-center justify-between"><h2 className="text-2xl font-black">{editing==="new"?(en?"Add ticket":"Добавить билет"):(en?"Edit ticket":"Редактировать билет")}</h2><button type="button" onClick={()=>setEditing(null)} aria-label="Close" className="text-2xl">×</button></div>
       <div className="space-y-4">
        <label className="block text-sm font-bold">{en?"Ticket name":"Название билета"}<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Adult / Child / VIP" className="mt-1 w-full rounded-lg border border-black/30 p-3"/></label>
        <label className="block text-sm font-bold">{en?"Description (optional)":"Описание (необязательно)"}<textarea rows={3} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} className="mt-1 w-full rounded-lg border border-black/30 p-3"/></label>
        <div className="grid grid-cols-2 gap-3">
         <label className="block text-sm font-bold">{en?"Price (NZD)":"Цена (NZD)"}<input required type="number" min="0" step="0.01" value={form.price} onChange={e=>setForm({...form,price:e.target.value})} className="mt-1 w-full rounded-lg border border-black/30 p-3"/></label>
         <label className="block text-sm font-bold">{en?"Total quantity":"Общее количество"}<input required type="number" min="0" step="1" value={form.quantity} onChange={e=>setForm({...form,quantity:e.target.value})} className="mt-1 w-full rounded-lg border border-black/30 p-3"/></label>
        </div>
        <label className="flex items-center gap-3 rounded-lg bg-[#fff2db] p-3 text-sm font-bold"><input type="checkbox" checked={form.showRemaining} onChange={e=>setForm({...form,showRemaining:e.target.checked})} className="h-5 w-5"/> Show remaining ticket quantity to customers</label>
        <label className="flex items-center gap-3 rounded-lg bg-[#fff2db] p-3 text-sm font-bold"><input type="checkbox" checked={form.active} onChange={e=>setForm({...form,active:e.target.checked})} className="h-5 w-5"/> Visible to customers</label>
       </div>
       {error&&<p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
       <div className="mt-6 flex gap-3"><button disabled={saving} type="submit" className="flex-1 rounded-lg bg-black px-5 py-4 font-bold text-white disabled:opacity-50">{saving?(en?"Saving…":"Сохранение…"):(en?"Save ticket":"Сохранить билет")}</button><button type="button" onClick={()=>setEditing(null)} className="rounded-lg border px-4">{en?"Cancel":"Отмена"}</button></div>
     </form>
   </div>}
 </main>;
}
