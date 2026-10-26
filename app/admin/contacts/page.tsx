"use client";

import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {supabase} from "@/lib/supabaseClient";
import {useSiteLanguage} from "@/lib/useSiteLanguage";

type MarketingContact={
 id:string;email:string;full_name:string;status:"subscribed"|"unsubscribed";
 consent_at:string;consent_source:string;source_event_id:string|null;
 unsubscribe_token:string;unsubscribed_at:string|null;
};

function asCsvCell(value:string):string{
 // Avoid spreadsheet formula injection from customer-controlled fields.
 const safe=/^[=+@\-\t\r]/.test(value)?"'"+value:value;
 return '"'+safe.replaceAll('"','""')+'"';
}

export default function MarketingContactsPage(){
 const router=useRouter();
 const en=useSiteLanguage()==="en";
 const [allowed,setAllowed]=useState(false);
 const [loading,setLoading]=useState(true);
 const [contacts,setContacts]=useState<MarketingContact[]>([]);
 const [search,setSearch]=useState("");
 const [showUnsubscribed,setShowUnsubscribed]=useState(false);
 const [busy,setBusy]=useState<string|null>(null);
 const [error,setError]=useState("");
 const [message,setMessage]=useState("");

 async function load(){
  const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError||!user){router.replace("/admin/login");return;}
  const {data:membership,error:roleError}=await supabase.from("admin_users")
   .select("role").eq("user_id",user.id).maybeSingle();
  if(roleError||!membership||!["owner","admin"].includes(membership.role)){
   router.replace("/admin/login");return;
  }
  setAllowed(true);
  const {data,error:fetchError}=await supabase.from("marketing_contacts")
   .select("id,email,full_name,status,consent_at,consent_source,source_event_id,unsubscribe_token,unsubscribed_at")
   .order("consent_at",{ascending:false}).limit(500);
  if(fetchError)throw fetchError;
  setContacts((data??[]) as MarketingContact[]);
 }
 useEffect(()=>{
  let active=true;
  void (async()=>{try{await load()}catch(err){
   if(active)setError(err instanceof Error?err.message:"Unable to load marketing contacts.");
  }finally{if(active)setLoading(false)}})();
  return()=>{active=false};
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[router]);

 const visible=useMemo(()=>contacts.filter(c=>
  (showUnsubscribed||c.status==="subscribed")&&
  (!search.trim()||[c.email,c.full_name].some(s=>s.toLowerCase().includes(search.trim().toLowerCase())))
 ),[contacts,search,showUnsubscribed]);
 const optedIn=contacts.filter(c=>c.status==="subscribed");
 function exportCsv(){
  // Explicit admin click. Never export unsubscribed addresses as mailing recipients.
  const rows=[
   ["Name","Email","Consent date (UTC)","Consent source","Unsubscribe URL"],
   ...optedIn.map(c=>[c.full_name,c.email,c.consent_at,c.consent_source,
    window.location.origin+"/unsubscribe?token="+encodeURIComponent(c.unsubscribe_token)]),
  ];
  const csv="\uFEFF"+rows.map(row=>row.map(asCsvCell).join(",")).join("\r\n")+"\r\n";
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;a.download="yumorilnik-opted-in-contacts.csv";
  a.click();URL.revokeObjectURL(url);
 }
 async function unsubscribe(contact:MarketingContact){
  setBusy(contact.id);setError("");setMessage("");
  try{
   const {data,error:rpcError}=await supabase.rpc("marketing_admin_unsubscribe",{p_contact_id:contact.id});
   if(rpcError)throw rpcError;
   if(data!==true)throw new Error(en?"Contact was not found.":"Контакт не найден.");
   setContacts(old=>old.map(c=>c.id===contact.id?{...c,status:"unsubscribed",unsubscribed_at:new Date().toISOString()}:c));
   setMessage(en?"Contact unsubscribed. This address will not be included in exports.":"Контакт отписан. Адрес больше не попадёт в экспорт.");
  }catch(err){setError(err instanceof Error?err.message:"Unable to unsubscribe contact.")}
  finally{setBusy(null)}
 }
 if(loading)return <main className="min-h-screen bg-[#fff2db] p-6" role="status">{en?"Loading contacts…":"Загрузка контактов…"}</main>;
 if(!allowed)return <main className="min-h-screen bg-[#fff2db] p-6" role="alert">{error|| (en?"Checking admin access…":"Проверяем права доступа…")}</main>;
 return <main className="min-h-screen bg-[#fff2db] px-4 py-8 text-black sm:px-8">
  <div className="mx-auto max-w-5xl space-y-5">
   <Link href="/admin" className="font-semibold underline">{en?"← Admin dashboard":"← Панель управления"}</Link>
   <div><h1 className="text-3xl font-black">{en?"Future event invitations":"Приглашения на будущие мероприятия"}</h1>
    <p className="mt-2 text-sm text-gray-700">{en?"Only adults who separately opted in on the booking form appear here. Children and other guests are not added automatically. Sending marketing emails is not enabled in this version.":"Здесь только взрослые, которые отдельно согласились получать приглашения при оформлении заявки. Дети и другие гости автоматически не добавляются. Рассылка пока не подключена."}</p>
   </div>
   {error&&<p role="alert" className="rounded-lg bg-red-100 p-3 text-red-800">{error}</p>}
   {message&&<p role="status" className="rounded-lg bg-green-100 p-3 text-green-800">{message}</p>}
   <div className="grid gap-3 rounded-xl border border-black/15 bg-white p-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
    <label className="text-sm font-semibold">{en?"Search subscribed contacts":"Поиск подписчиков"}
     <input type="search" value={search} onChange={e=>setSearch(e.target.value)} className="mt-2 h-12 w-full rounded-lg border border-black/30 px-3 text-base" />
    </label>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showUnsubscribed} onChange={e=>setShowUnsubscribed(e.target.checked)} className="h-5 w-5"/>{en?"Show unsubscribed":"Показать отписавшихся"}</label>
    <button type="button" className="h-12 rounded-lg border border-black px-4 font-semibold" onClick={()=>{setLoading(true);setError("");void load().catch(err=>setError(err instanceof Error?err.message:"Reload failed")).finally(()=>setLoading(false))}}>{en?"Refresh":"Обновить"}</button>
   </div>
   <div className="flex flex-wrap items-center justify-between gap-3">
    <p className="font-semibold">{optedIn.length} {en?"subscribed contacts (latest 500 loaded)":"подписчиков (загружены последние 500)"}</p>
    <button type="button" disabled={optedIn.length===0} onClick={exportCsv} className="min-h-11 rounded-lg bg-black px-4 py-3 text-sm font-bold text-white disabled:opacity-40">{en?"Export subscribed CSV":"Скачать CSV подписчиков"}</button>
   </div>
   <p className="text-xs text-gray-700">{en?"CSV contains consent dates and unique unsubscribe URLs. Keep it private; only use it for future invitations after complying with email marketing requirements. Never email unsubscribed contacts.":"CSV содержит даты согласия и персональные ссылки отписки. Храните файл конфиденциально; используйте только для законных приглашений. Не пишите отписавшимся."}</p>
   {visible.length===0?<p className="rounded-xl bg-white p-6">{en?"No matching opted-in contacts.":"Подходящих контактов нет."}</p>:<div className="grid gap-3">
    {visible.map(c=><article key={c.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-black/15 bg-white p-4">
     <div className="min-w-0"><h2 className="font-bold">{c.full_name}</h2><p className="break-all text-sm">{c.email}</p>
      <p className="text-xs text-gray-600">{en?"Consent recorded":"Согласие получено"}: {new Date(c.consent_at).toLocaleString(en?"en-NZ":"ru-RU")}</p>
      <p className={c.status==="subscribed"?"mt-1 text-xs font-semibold text-green-800":"mt-1 text-xs font-semibold text-red-800"}>{c.status==="subscribed"?(en?"Opted in":"Подписан"):(en?"Unsubscribed":"Отписался")}</p>
     </div>
     {c.status==="subscribed"&&<button type="button" disabled={busy===c.id} onClick={()=>{if(window.confirm(en?"Remove this email from future invitations?":"Убрать этот адрес из будущих приглашений?"))void unsubscribe(c);}} className="min-h-11 rounded-lg border border-red-700 px-4 text-sm font-semibold text-red-800 disabled:opacity-50">{en?"Unsubscribe":"Отписать"}</button>}
    </article>)}
   </div>}
  </div>
 </main>;
}
