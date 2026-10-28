"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {supabase} from "@/lib/supabaseClient";
import {useSiteLanguage} from "@/lib/useSiteLanguage";
type Event={id:string;title:string;event_date:string};
type Staff={email:string;active:boolean};
const reason=(error:unknown)=>((error as {message?:string})?.message||String(error));
export default function StaffManagement(){
 const en=useSiteLanguage()==="en",router=useRouter();
 const [events,setEvents]=useState<Event[]>([]),[selected,setSelected]=useState("");
 const [staff,setStaff]=useState<Staff[]>([]),[email,setEmail]=useState("");
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(""),[message,setMessage]=useState("");
 async function loadStaff(id:string){
  const {data,error:fetchError}=await supabase.rpc("admin_list_checkin_staff",{p_event_id:id});
  if(fetchError)throw fetchError;
  setStaff((data??[]) as Staff[]);
 }
 useEffect(()=>{
  void (async()=>{
   try{
    const {data:{user}}=await supabase.auth.getUser();
    if(!user){router.replace("/admin/login");return;}
    const {data:role}=await supabase.from("admin_users").select("role").eq("user_id",user.id).maybeSingle();
    if(!role||!["owner","admin"].includes(role.role)){router.replace("/admin/login");return;}
    const {data:rows,error:eventsError}=await supabase.from("events").select("id,title,event_date").order("event_date",{ascending:false});
    if(eventsError)throw eventsError;
    const list=(rows??[]) as Event[];
    setEvents(list);
    if(list.length){setSelected(list[0].id);await loadStaff(list[0].id);}
   }catch(e){setError(reason(e))}
   finally{setLoading(false)}
  })();
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[router]);
 async function grant(address:string,active:boolean){
  if(!selected||!address.trim())return;
  setBusy(true);setError("");setMessage("");
  try{
   const {error:saveError}=await supabase.rpc("admin_assign_checkin_staff",{
    p_event_id:selected,p_email:address.trim(),p_active:active,
   });
   if(saveError)throw saveError;
   await loadStaff(selected);
   setEmail("");
   setMessage(en?"Staff access updated.":"Доступ персонала обновлён.");
  }catch(e){setError(reason(e))}
  finally{setBusy(false)}
 }
 return <main className="min-h-screen bg-[#fff2db] px-4 py-8 text-black sm:px-8">
  <div className="mx-auto max-w-3xl space-y-5">
   <Link href="/admin" className="text-sm font-semibold underline">{en?"← Admin dashboard":"← Панель администратора"}</Link>
   <h1 className="text-3xl font-black">{en?"Door-staff access":"Доступ персонала на входе"}</h1>
   <p className="rounded-lg border border-black/15 bg-white p-4 text-sm">{en?"Staff must first sign in with Google at /staff/login. Then add their Google email here. They will only see guest check-in, not prices, payments or contact information.":"Сотрудник сначала должен войти через Google по адресу /staff/login. Затем укажите его адрес здесь. Персонал видит только регистрацию гостей, без цен, оплат и контактов."}</p>
   <Link href="/staff/login" className="inline-block rounded-lg border border-black bg-white px-4 py-2 text-sm font-semibold underline">{en?"Open staff login →":"Открыть вход для персонала →"}</Link>
   {error&&<p role="alert" className="rounded bg-red-100 p-3 text-sm text-red-800">{error}</p>}
   {message&&<p role="status" className="rounded bg-green-100 p-3 text-sm">{message}</p>}
   {loading?<p>{en?"Loading…":"Загрузка…"}</p>:events.length===0?<p>{en?"Create an event first.":"Сначала создайте мероприятие."}</p>:<>
    <label className="block text-sm font-semibold">{en?"Event":"Мероприятие"}<select value={selected} onChange={e=>{setSelected(e.target.value);void loadStaff(e.target.value).catch(err=>setError(reason(err)))}} className="mt-1 w-full rounded-lg border border-black/30 bg-white p-3">{events.map(e=><option key={e.id} value={e.id}>{e.title} · {e.event_date}</option>)}</select></label>
    <div className="space-y-3 rounded-xl border border-black/20 bg-white p-5">
     <h2 className="text-xl font-bold">{en?"Grant access":"Назначить доступ"}</h2>
     <label className="block text-sm font-semibold">{en?"Staff Google email":"Email сотрудника (Google)"}<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="staff@example.com" className="mt-1 w-full rounded-lg border border-black/30 p-3"/></label>
     <button type="button" disabled={busy||!email.trim()} onClick={()=>void grant(email,true)} className="rounded-lg bg-black px-5 py-3 font-bold text-white disabled:opacity-50">{en?"Grant check-in access":"Дать доступ"}</button>
    </div>
    <section className="space-y-3 rounded-xl border border-black/20 bg-white p-5"><h2 className="text-xl font-bold">{en?"Staff for this event":"Персонал мероприятия"}</h2>{staff.length===0?<p className="text-sm">{en?"No staff added yet.":"Персонал пока не добавлен."}</p>:staff.map(person=><div key={person.email} className="flex flex-wrap items-center justify-between gap-3 border-b py-3"><div><p className="font-semibold">{person.email}</p><p className="text-xs">{person.active?(en?"Access granted":"Доступ есть"):(en?"Access revoked":"Доступ отозван")}</p></div><button type="button" disabled={busy} onClick={()=>void grant(person.email,!person.active)} className="rounded-lg border border-black px-3 py-2 font-semibold">{person.active?(en?"Revoke":"Отозвать"):(en?"Restore":"Вернуть")}</button></div>)}</section>
   </>}
  </div>
 </main>;
}
