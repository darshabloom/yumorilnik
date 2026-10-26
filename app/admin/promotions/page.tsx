"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {supabase} from "@/lib/supabaseClient";
import {useSiteLanguage} from "@/lib/useSiteLanguage";

type Type="percentage"|"amount_off"|"fixed_price";
type Promo={code:string;enabled:boolean;discount_type:Type;percent_off:number;amount_cents:number|null;event_id:string|null;max_uses:number|null;times_used:number};
type Event={id:string;title:string};
type Edit={code:string;enabled:boolean;discount_type:Type;amount:string;event_id:string;max_uses:string};
const blank:Edit={code:"",enabled:false,discount_type:"percentage",amount:"20",event_id:"",max_uses:""};
function toEdit(p:Promo):Edit{return {code:p.code,enabled:p.enabled,discount_type:p.discount_type,amount:p.discount_type==="percentage"?String(p.percent_off):String((p.amount_cents??0)/100),event_id:p.event_id??"",max_uses:p.max_uses===null?"":String(p.max_uses)};}

export default function PromotionsAdmin(){
 const router=useRouter();
 const en=useSiteLanguage()==="en";
 const [promos,setPromos]=useState<Promo[]>([]);
 const [events,setEvents]=useState<Event[]>([]);
 const [edit,setEdit]=useState<Edit>(blank);
 const [ready,setReady]=useState(false);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 const [error,setError]=useState("");
 async function reload(){
  const {data:rows,error:rowsError}=await supabase.rpc("admin_list_booking_promotions");
  if(rowsError)throw rowsError;
  setPromos((rows??[]) as Promo[]);
 }
 useEffect(()=>{
  void (async()=>{
   try{
    const {data:{user}}=await supabase.auth.getUser();
    if(!user){router.replace("/admin/login");return;}
    const {data:role}=await supabase.from("admin_users").select("role").eq("user_id",user.id).maybeSingle();
    if(!role||!["owner","admin"].includes(role.role)){router.replace("/admin/login");return;}
    const {data:eventRows,error:eventError}=await supabase.from("events").select("id,title").order("event_date",{ascending:false});
    if(eventError)throw eventError;
    setEvents((eventRows??[]) as Event[]);
    await reload();
   }catch(e){setError(e instanceof Error?e.message:String(e))}
   finally{setReady(true);}
  })();
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[router]);
 const update=(patch:Partial<Edit>)=>setEdit(prev=>({...prev,...patch}));
 async function save(){
  setMessage("");setError("");
  const amount=Number(edit.amount);
  const uses=edit.max_uses===""?null:Number(edit.max_uses);
  if(!edit.code.trim()||!Number.isFinite(amount)||amount<0||
     (edit.discount_type==="percentage"&&(amount<1||amount>100||!Number.isInteger(amount)))||
     (uses!==null&&(!Number.isInteger(uses)||uses<1))){
    setError(en?"Check the code, amount and usage limit.":"Проверьте код, сумму и лимит использований.");return;
  }
  setBusy(true);
  try{
   const {error:saveError}=await supabase.rpc("admin_save_booking_promotion",{
    p_code:edit.code.trim().toUpperCase(),p_enabled:edit.enabled,
    p_discount_type:edit.discount_type,
    p_percent_off:edit.discount_type==="percentage"?amount:0,
    p_amount_cents:edit.discount_type==="percentage"?null:Math.round(amount*100),
    p_event_id:edit.event_id||null,p_max_uses:uses,
   });
   if(saveError)throw saveError;
   await reload();setEdit(blank);
   setMessage(en?"Promotion saved. Paid-code redemption is not live yet.":"Промокод сохранён. Оплата и применение платных скидок ещё не подключены.");
  }catch(e){setError(e instanceof Error?e.message:String(e))}
  finally{setBusy(false)}
 }
 const caption=(p:Promo)=>p.discount_type==="percentage"?
  `${p.percent_off}% ${en?"off each adult place":"скидка на каждое взрослое место"}`:
  p.discount_type==="amount_off"?
  `NZ$${((p.amount_cents??0)/100).toFixed(2)} ${en?"off each adult place":"скидка на каждое взрослое место"}`:
  `NZ$${((p.amount_cents??0)/100).toFixed(2)} ${en?"per adult place":"за взрослое место"}`;
 return <main className="min-h-screen bg-[#fff5e3] px-4 py-9 text-black sm:px-8">
  <div className="mx-auto max-w-5xl space-y-6">
   <Link href="/admin" className="underline">{en?"← Admin dashboard":"← Панель администратора"}</Link>
   <h1 className="text-3xl font-black">{en?"Promo codes":"Промокоды"}</h1>
   <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">{en?
    "Discounts affect adult table places only. Children's admission always stays at NZ$30. TEST12 free bookings are not activated yet. Other codes can be prepared here, but codes leaving money payable cannot be redeemed until checkout is implemented.":
    "Скидки действуют только на места взрослых за столами. Детский билет всегда стоит NZ$30. Бесплатные брони TEST12 ещё не включены. Другие промокоды можно подготовить здесь, но оплачиваемые заказы пока недоступны."}</p>
   {error&&<p role="alert" className="rounded bg-red-100 p-3 text-red-900">{error}</p>}
   {message&&<p role="status" className="rounded bg-green-100 p-3 text-green-900">{message}</p>}
   {!ready?<p>{en?"Loading…":"Загрузка…"}</p>:<>
    <section className="rounded-xl border-2 border-black bg-white p-5">
     <h2 className="mb-4 text-xl font-bold">{en?"Existing codes":"Существующие промокоды"}</h2>
     {promos.length===0?<p>{en?"No codes yet.":"Промокодов пока нет."}</p>:<div className="space-y-3">{promos.map(p=><div key={p.code} className="flex flex-wrap items-center justify-between gap-3 border-b border-black/15 py-3">
      <div><p className="font-bold">{p.code} <span className="ml-2 text-xs font-normal">{p.enabled?(en?"Enabled":"Включён"):(en?"Disabled":"Выключен")}</span></p>
      <p className="text-sm">{caption(p)}</p>
      <p className="text-xs text-gray-600">{p.event_id?events.find(e=>e.id===p.event_id)?.title??p.event_id:(en?"All events":"Все мероприятия")} · {p.times_used}/{p.max_uses??"∞"}</p></div>
      <button type="button" onClick={()=>{setEdit(toEdit(p));setError("");setMessage("");}} className="rounded-lg border border-black px-4 py-2 font-semibold">{en?"Edit":"Изменить"}</button>
     </div>)}</div>}
    </section>
    <section className="space-y-4 rounded-xl border-2 border-black bg-white p-5">
     <div className="flex items-center justify-between"><h2 className="text-xl font-bold">{en?"Create / edit code":"Создать / изменить промокод"}</h2>
      <button type="button" className="text-sm underline" onClick={()=>setEdit(blank)}>{en?"New code":"Новый код"}</button></div>
     <div className="grid gap-4 sm:grid-cols-2">
      <label className="block text-sm font-semibold">{en?"Code":"Промокод"}<input value={edit.code} onChange={e=>update({code:e.target.value.toUpperCase()})} maxLength={32} className="mt-1 w-full rounded-lg border border-black/30 p-3"/></label>
      <label className="block text-sm font-semibold">{en?"Discount type":"Тип скидки"}<select value={edit.discount_type} onChange={e=>update({discount_type:e.target.value as Type,amount:"20"})} className="mt-1 w-full rounded-lg border border-black/30 p-3">
       <option value="percentage">{en?"Percent off each adult seat":"Процент скидки на взрослое место"}</option>
       <option value="amount_off">{en?"Amount off each adult seat":"Сумма скидки на взрослое место"}</option>
       <option value="fixed_price">{en?"Fixed adult seat price":"Фиксированная цена взрослого места"}</option>
      </select></label>
      <label className="block text-sm font-semibold">{edit.discount_type==="percentage"?(en?"Percent (%)":"Процент (%)"):(en?"Amount (NZ$)":"Сумма (NZ$)")}<input type="number" min={edit.discount_type==="percentage"?"1":"0"} max={edit.discount_type==="percentage"?"100":undefined} step={edit.discount_type==="percentage"?"1":"0.01"} value={edit.amount} onChange={e=>update({amount:e.target.value})} className="mt-1 w-full rounded-lg border border-black/30 p-3"/></label>
      <label className="block text-sm font-semibold">{en?"Event":"Мероприятие"}<select value={edit.event_id} onChange={e=>update({event_id:e.target.value})} className="mt-1 w-full rounded-lg border border-black/30 p-3"><option value="">{en?"All events":"Все мероприятия"}</option>{events.map(e=><option key={e.id} value={e.id}>{e.title}</option>)}</select></label>
      <label className="block text-sm font-semibold">{en?"Maximum uses (optional)":"Лимит использований (необязательно)"}<input type="number" min="1" step="1" value={edit.max_uses} onChange={e=>update({max_uses:e.target.value})} className="mt-1 w-full rounded-lg border border-black/30 p-3"/></label>
      <label className="flex items-center gap-3 self-end pb-3 text-sm font-semibold"><input type="checkbox" checked={edit.enabled} onChange={e=>update({enabled:e.target.checked})}/>{en?"Enabled":"Включён"}</label>
     </div>
     <button type="button" disabled={busy} onClick={()=>void save()} className="rounded-lg bg-black px-6 py-3 font-bold text-white disabled:opacity-40">{busy?(en?"Saving…":"Сохранение…"):(en?"Save promo code":"Сохранить промокод")}</button>
    </section>
   </>}
  </div>
 </main>;
}
