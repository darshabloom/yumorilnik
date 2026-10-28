"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {supabase} from "@/lib/supabaseClient";
import {useSiteLanguage} from "@/lib/useSiteLanguage";
type Event={id:string;title:string;event_date:string};
type Guest={
 booking_id:string;booking_reference:string;guest_index:number;full_name:string;
 is_child:boolean;childcare_hours:number|null;guardian_name:string|null;
 table_label:string|null;seat_number:number|null;checked_in_at:string|null;
};
function explain(error:unknown){const e=error as {message?:string}|null;return e?.message||String(error)}
export default function StaffCheckin(){
 const en=useSiteLanguage()==="en",router=useRouter();
 const [events,setEvents]=useState<Event[]>([]),[selected,setSelected]=useState("");
 const [guests,setGuests]=useState<Guest[]>([]);
 const [query,setQuery]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 async function refresh(eventId:string){
  const {data,error:fetchError}=await supabase.rpc("staff_list_event_guests",{p_event_id:eventId});
  if(fetchError)throw fetchError;
  setGuests((data??[]) as Guest[]);
 }
 useEffect(()=>{
  void (async()=>{
   try{
    const {data:{user}}=await supabase.auth.getUser();
    if(!user){router.replace("/staff/login");return;}
    const {data,error:accessError}=await supabase.rpc("staff_available_events");
    if(accessError)throw accessError;
    const allowed=(data??[]) as Event[];
    setEvents(allowed);
    if(allowed.length){setSelected(allowed[0].id);await refresh(allowed[0].id);}
   }catch(e){setError(explain(e))}
   finally{setLoading(false);}
  })();
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[router]);
 const filtered=useMemo(()=>{
  const term=query.trim().toLowerCase();
  return guests.filter(g=>!term||g.full_name.toLowerCase().includes(term)||g.booking_reference.toLowerCase().includes(term)||g.guardian_name?.toLowerCase().includes(term));
 },[query,guests]);
 async function setArrival(guest:Guest,arrived:boolean){
  if(busy)return;
  setBusy(true);setError("");
  try{
   const {data,error:rpcError}=await supabase.rpc("staff_set_guest_checkin",{
    p_booking_id:guest.booking_id,p_guest_index:guest.guest_index,p_arrived:arrived,
   });
   if(rpcError)throw rpcError;
   if(data!==true)throw new Error("Could not update guest");
   await refresh(selected);
  }catch(e){setError(explain(e))}
  finally{setBusy(false)}
 }
 async function changeEvent(id:string){setSelected(id);setQuery("");setError("");try{await refresh(id)}catch(e){setError(explain(e));setGuests([])}}
 async function signOut(){await supabase.auth.signOut();router.replace("/staff/login");}
 const arrived=guests.filter(g=>g.checked_in_at).length;
 return <main className="min-h-screen bg-[#fff2db] px-4 py-8 text-black sm:px-8">
  <div className="mx-auto max-w-4xl space-y-5">
   <div className="flex flex-wrap items-center justify-between gap-3"><div>
    <Link href="/" className="text-sm font-semibold underline">{en?"← Website":"← На сайт"}</Link>
    <h1 className="mt-3 text-3xl font-black">{en?"Event check-in":"Регистрация гостей"}</h1>
   </div><button type="button" onClick={()=>void signOut()} className="rounded-lg border border-black px-4 py-2 font-semibold">{en?"Sign out":"Выйти"}</button></div>
   <p className="rounded-lg border border-black/20 bg-white p-3 text-sm">{en?"Staff view only. No payments, personal contact information or administrative settings are available here.":"Только для персонала. Нет доступа к оплатам, личным контактам или настройкам администрации."}</p>
   {error&&<p role="alert" className="rounded bg-red-100 p-3 text-sm text-red-800">{error}</p>}
   {loading?<p>{en?"Checking access…":"Проверяем доступ…"}</p>:events.length===0?<p className="rounded-lg bg-white p-4">{en?"No event check-in access yet. Ask Marina to grant you access after signing in.":"Нет доступа к мероприятиям. После входа попросите Марину назначить вам доступ."}</p>:<>
    <div className="grid gap-3 rounded-xl border border-black/15 bg-white p-4 sm:grid-cols-2">
     <label className="text-sm font-semibold">{en?"Event":"Мероприятие"}
      <select className="mt-1 w-full rounded-lg border border-black/30 p-3" value={selected} onChange={e=>void changeEvent(e.target.value)}>{events.map(e=><option key={e.id} value={e.id}>{e.title} · {e.event_date}</option>)}</select>
     </label>
     <label className="text-sm font-semibold">{en?"Search by guest or booking reference":"Поиск по гостю или номеру брони"}
      <input className="mt-1 w-full rounded-lg border border-black/30 p-3" value={query} onChange={e=>setQuery(e.target.value)} placeholder={en?"Name or YMR-…":"Имя или YMR-…"}/>
     </label>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="font-bold">{en?"Arrived":"Пришли"}: {arrived}/{guests.length}</p><button type="button" onClick={()=>void refresh(selected).catch(e=>setError(explain(e)))} className="rounded-lg border border-black px-4 py-2 font-semibold">{en?"Refresh":"Обновить"}</button></div>
    {filtered.length===0?<p className="rounded-lg bg-white p-4">{en?"No matching confirmed guests.":"Нет подходящих подтверждённых гостей."}</p>:<div className="space-y-3">{filtered.map(g=><article key={`${g.booking_id}:${g.guest_index}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/15 bg-white p-4">
      <div className="min-w-0 flex-1 space-y-1"><p className="break-words font-bold">{g.full_name} {g.is_child?<span className="text-sm font-normal">· {en?"Child":"Ребёнок"}</span>:null}</p>
       <p className="text-xs text-gray-600">{g.booking_reference}</p>
       <p className="text-sm">{g.table_label?`${en?"Table":"Стол"} ${g.table_label} · ${en?"seat":"место"} ${g.seat_number??"—"}`:(en?"No assigned table seat":"Без закреплённого места")}</p>
       {g.is_child&&g.childcare_hours&&<p className="text-sm font-semibold">{en?"Childcare":"Присмотр"}: {g.childcare_hours} {en?"hours":"часов"}</p>}
       {g.guardian_name&&<p className="text-sm">{en?"Guardian":"Сопровождающий"}: {g.guardian_name}</p>}
      </div><button disabled={busy} type="button" onClick={()=>void setArrival(g,!g.checked_in_at)} className={`min-h-11 rounded-lg px-4 py-3 text-sm font-bold disabled:opacity-50 ${g.checked_in_at?"border border-black bg-green-100":"bg-black text-white"}`}>{g.checked_in_at?(en?"✓ Arrived · Undo":"✓ Пришёл · Отменить"):(en?"Check in":"Зарегистрировать")}</button>
     </article>)}</div>}
   </>}
  </div>
 </main>;
}
