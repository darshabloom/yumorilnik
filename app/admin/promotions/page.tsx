"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {supabase} from "@/lib/supabaseClient";
import {useSiteLanguage} from "@/lib/useSiteLanguage";

type Type="percentage"|"amount_off"|"fixed_price";
type Scope="all"|"adult"|"child"|"selected";
type Promo={code:string;enabled:boolean;discount_type:Type;percent_off:number;amount_cents:number|null;event_id:string|null;max_uses:number|null;times_used:number;applies_to:Scope;ticket_type_ids:string[];starts_at:string|null;ends_at:string|null;min_tickets:number|null;max_discount_cents:number|null;internal_note:string|null};
type Event={id:string;title:string};
type Ticket={id:string;name:string;event_id:string;price_cents:number};
type Edit={code:string;enabled:boolean;discount_type:Type;amount:string;event_id:string;max_uses:string;applies_to:Scope;ticket_type_ids:string[];starts_at:string;ends_at:string;min_tickets:string;max_discount:string;internal_note:string};
const blank:Edit={code:"",enabled:false,discount_type:"percentage",amount:"20",event_id:"",max_uses:"",applies_to:"all",ticket_type_ids:[],starts_at:"",ends_at:"",min_tickets:"",max_discount:"",internal_note:""};
const localDate=(iso:string|null)=>iso?new Date(iso).toISOString().slice(0,16):"";
function explainSaveError(e:unknown,en:boolean){
 const value=e as {message?:unknown;details?:unknown;hint?:unknown;code?:unknown}|null;
 const message=typeof value?.message==="string"?value.message:e instanceof Error?e.message:"";
 const details=typeof value?.details==="string"?value.details:"";
 const hint=typeof value?.hint==="string"?value.hint:"";
 const reason=message||details||hint;
 if(/TEST12 activation requires the updated checkout/i.test(reason))
  return en?"TEST12 settings can be saved, but the code cannot be enabled until checkout is ready. Untick Enabled and save again.":"Настройки TEST12 можно сохранить, но включить код пока нельзя. Снимите галочку «Включён» и сохраните снова.";
 if(/Admin access required|permission denied/i.test(reason))
  return en?"Your account does not have permission to manage promo codes. Sign in as an owner or admin.":"Нет прав для изменения промокодов. Войдите как владелец или администратор.";
 if(/Usage limit below prior redemptions/i.test(reason))
  return en?"The maximum uses cannot be lower than the number already redeemed.":"Лимит использований не может быть меньше уже применённого количества.";
 if(reason)return [reason,details,hint].filter((v,i,a)=>v&&a.indexOf(v)===i).join(" · ");
 return en?"Could not save promo code. Please retry.":"Не удалось сохранить промокод. Повторите попытку.";
}
function toEdit(p:Promo):Edit{return {code:p.code,enabled:p.enabled,discount_type:p.discount_type,amount:p.discount_type==="percentage"?String(p.percent_off):String((p.amount_cents??0)/100),event_id:p.event_id??"",max_uses:p.max_uses===null?"":String(p.max_uses),applies_to:p.applies_to??"all",ticket_type_ids:p.ticket_type_ids??[],starts_at:localDate(p.starts_at),ends_at:localDate(p.ends_at),min_tickets:p.min_tickets===null?"":String(p.min_tickets),max_discount:p.max_discount_cents===null?"":String(p.max_discount_cents/100),internal_note:p.internal_note??""};}

export default function PromotionsAdmin(){
 const router=useRouter();
 const en=useSiteLanguage()==="en";
 const [promos,setPromos]=useState<Promo[]>([]);
 const [events,setEvents]=useState<Event[]>([]);
 const [tickets,setTickets]=useState<Ticket[]>([]);
 const [edit,setEdit]=useState<Edit>(blank);
 const [ready,setReady]=useState(false);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 const [error,setError]=useState("");
 async function reload(){
  const {data:rows,error:rowsError}=await supabase.rpc("admin_list_booking_promotions_v2");
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
    const {data:ticketRows,error:ticketError}=await supabase.from("ticket_types").select("id,name,event_id,price_cents");
    if(ticketError)throw ticketError;
    setTickets((ticketRows??[]) as Ticket[]);
    await reload();
   }catch(e){setError(explainSaveError(e,en))}
   finally{setReady(true);}
  })();
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[router]);
 const update=(patch:Partial<Edit>)=>setEdit(prev=>({...prev,...patch}));
 async function save(){
  setMessage("");setError("");
  if(edit.code.trim().toUpperCase()==="TEST12"&&edit.enabled){
   setError(en?"TEST12 is not ready to be enabled. Untick Enabled to save its settings.":"TEST12 пока нельзя включить. Снимите галочку «Включён», чтобы сохранить настройки.");
   return;
  }
  const amount=Number(edit.amount);
  const uses=edit.max_uses===""?null:Number(edit.max_uses);
  const minimum=edit.min_tickets===""?null:Number(edit.min_tickets);
  const cap=edit.max_discount===""?null:Number(edit.max_discount);
  const start=edit.starts_at?new Date(edit.starts_at):null;
  const end=edit.ends_at?new Date(edit.ends_at):null;
  if(!edit.code.trim()||!Number.isFinite(amount)||amount<0||
     (edit.discount_type==="percentage"&&(amount<1||amount>100||!Number.isInteger(amount)))||
     (uses!==null&&(!Number.isInteger(uses)||uses<1))||
     (minimum!==null&&(!Number.isInteger(minimum)||minimum<1))||
     (cap!==null&&(!Number.isFinite(cap)||cap<0))||
     (start!==null&&Number.isNaN(start.getTime()))||
     (end!==null&&Number.isNaN(end.getTime()))||
     (start!==null&&end!==null&&end<=start)||
     (edit.applies_to==="selected"&&edit.ticket_type_ids.length===0)){
    setError(en?"Check the code, amount and usage limit.":"Проверьте код, сумму и лимит использований.");return;
  }
  setBusy(true);
  try{
   const {error:saveError}=await supabase.rpc("admin_save_booking_promotion_v2",{
    p_code:edit.code.trim().toUpperCase(),p_enabled:edit.enabled,
    p_discount_type:edit.discount_type,
    p_percent_off:edit.discount_type==="percentage"?amount:0,
    p_amount_cents:edit.discount_type==="percentage"?null:Math.round(amount*100),
    p_event_id:edit.event_id||null,p_max_uses:uses,
    p_applies_to:edit.applies_to,p_ticket_type_ids:edit.applies_to==="selected"?edit.ticket_type_ids:[],
    p_starts_at:start?.toISOString()??null,p_ends_at:end?.toISOString()??null,
    p_min_tickets:minimum,p_max_discount_cents:cap===null?null:Math.round(cap*100),
    p_internal_note:edit.internal_note.trim()||null,
   });
   if(saveError)throw saveError;
   await reload();setEdit(blank);
   setMessage(en?"Promotion saved. It will work only in the protected Stripe sandbox when enabled.":"Промокод сохранён. Он работает только в защищённом тестовом Stripe после настройки.");
  }catch(e){setError(e instanceof Error?e.message:String(e))}
  finally{setBusy(false)}
 }
 const caption=(p:Promo)=>{
  const label=p.discount_type==="percentage"?`${p.percent_off}% ${en?"off":"скидка"}`:p.discount_type==="amount_off"?`NZ$${((p.amount_cents??0)/100).toFixed(2)} ${en?"off":"скидка"}`:`NZ$${((p.amount_cents??0)/100).toFixed(2)} ${en?"fixed price":"фиксированная цена"}`;
  const scope=p.applies_to==="all"?(en?"all tickets":"все билеты"):p.applies_to==="adult"?(en?"adult seats":"взрослые"):p.applies_to==="child"?(en?"children":"дети"):(en?"selected tickets":"выбранные билеты");
  return label+" · "+scope;
 };
 return <main className="min-h-screen bg-[#fff5e3] px-4 py-9 text-black sm:px-8">
  <div className="mx-auto max-w-5xl space-y-6">
   <Link href="/admin" className="underline">{en?"← Admin dashboard":"← Панель администратора"}</Link>
   <h1 className="text-3xl font-black">{en?"Promo codes":"Промокоды"}</h1>
   <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">{en?
    "Codes can target all tickets, adults, children or selected ticket types. Codes can be redeemed in the protected Stripe sandbox once it is configured, but not in real payments. TEST12 remains disabled.":
    "Промокоды могут действовать на все билеты, взрослых, детей или выбранные типы. Коды работают только в защищённом тестовом Stripe после настройки; настоящие платежи не подключены. TEST12 остаётся выключенным."}</p>
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
       <option value="percentage">{en?"Percentage discount":"Процентная скидка"}</option>
       <option value="amount_off">{en?"Fixed amount off per applicable ticket":"Скидка с каждого подходящего билета"}</option>
       <option value="fixed_price">{en?"Fixed price per applicable ticket":"Фиксированная цена подходящего билета"}</option>
      </select></label>
      <label className="block text-sm font-semibold">{edit.discount_type==="percentage"?(en?"Percent (%)":"Процент (%)"):(en?"Amount (NZ$)":"Сумма (NZ$)")}<input type="number" min={edit.discount_type==="percentage"?"1":"0"} max={edit.discount_type==="percentage"?"100":undefined} step={edit.discount_type==="percentage"?"1":"0.01"} value={edit.amount} onChange={e=>update({amount:e.target.value})} className="mt-1 w-full rounded-lg border border-black/30 p-3"/></label>
      <label className="block text-sm font-semibold">{en?"Event":"Мероприятие"}<select value={edit.event_id} onChange={e=>update({event_id:e.target.value,ticket_type_ids:[]})} className="mt-1 w-full rounded-lg border border-black/30 p-3"><option value="">{en?"All events":"Все мероприятия"}</option>{events.map(e=><option key={e.id} value={e.id}>{e.title}</option>)}</select></label>
      <label className="block text-sm font-semibold">{en?"Maximum uses (optional)":"Лимит использований (необязательно)"}<input type="number" min="1" step="1" value={edit.max_uses} onChange={e=>update({max_uses:e.target.value})} className="mt-1 w-full rounded-lg border border-black/30 p-3"/></label>
      <label className="block text-sm font-semibold">{en?"Apply to ticket types":"К каким билетам применять"}<select value={edit.applies_to} onChange={e=>update({applies_to:e.target.value as Scope,ticket_type_ids:[]})} className="mt-1 w-full rounded-lg border border-black/30 p-3">
       <option value="all">{en?"All tickets":"Все билеты"}</option><option value="adult">{en?"Adult table seats":"Места для взрослых"}</option><option value="child">{en?"Child admission":"Детские билеты"}</option><option value="selected">{en?"Selected ticket types":"Выбранные типы билетов"}</option>
      </select></label>
      <label className="block text-sm font-semibold">{en?"Minimum tickets (optional)":"Минимум билетов"}<input type="number" min="1" step="1" value={edit.min_tickets} onChange={e=>update({min_tickets:e.target.value})} className="mt-1 w-full rounded-lg border border-black/30 p-3"/></label>
      <label className="block text-sm font-semibold">{en?"Starts (optional)":"Начало действия"}<input type="datetime-local" value={edit.starts_at} onChange={e=>update({starts_at:e.target.value})} className="mt-1 w-full rounded-lg border border-black/30 p-3"/></label>
      <label className="block text-sm font-semibold">{en?"Expires (optional)":"Окончание действия"}<input type="datetime-local" value={edit.ends_at} onChange={e=>update({ends_at:e.target.value})} className="mt-1 w-full rounded-lg border border-black/30 p-3"/></label>
      <label className="block text-sm font-semibold">{en?"Maximum total discount per booking (NZ$, optional)":"Макс. скидка за заказ (NZ$)"}<input type="number" min="0" step="0.01" value={edit.max_discount} onChange={e=>update({max_discount:e.target.value})} className="mt-1 w-full rounded-lg border border-black/30 p-3"/></label>
      <label className="block text-sm font-semibold">{en?"Internal note":"Внутренняя заметка"}<input maxLength={500} value={edit.internal_note} onChange={e=>update({internal_note:e.target.value})} className="mt-1 w-full rounded-lg border border-black/30 p-3"/></label>
      <label className="flex items-center gap-3 self-end pb-3 text-sm font-semibold"><input type="checkbox" disabled={edit.code.trim().toUpperCase()==="TEST12"} checked={edit.enabled&&edit.code.trim().toUpperCase()!=="TEST12"} onChange={e=>update({enabled:e.target.checked})}/>{en?"Enabled":"Включён"}</label>
     </div>
     {edit.applies_to==="selected"&&<fieldset className="rounded-lg border border-black/20 p-4"><legend className="font-bold">{en?"Select eligible tickets":"Выберите билеты"}</legend><div className="space-y-2">{tickets.filter(t=>!edit.event_id||t.event_id===edit.event_id).map(t=><label key={t.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.ticket_type_ids.includes(t.id)} onChange={e=>update({ticket_type_ids:e.target.checked?[...edit.ticket_type_ids,t.id]:edit.ticket_type_ids.filter(id=>id!==t.id)})}/><span>{t.name} · {events.find(e=>e.id===t.event_id)?.title}</span></label>)}</div></fieldset>}
     {edit.code.trim().toUpperCase()==="TEST12"&&<p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">{en?"You can save the details of TEST12 now. Activation is locked until promo redemption and payment rules are finished.":"Настройки TEST12 можно сохранить сейчас. Включение недоступно до завершения применения промокодов и правил оплаты."}</p>}
     <button type="button" disabled={busy} onClick={()=>void save()} className="rounded-lg bg-black px-6 py-3 font-bold text-white disabled:opacity-40">{busy?(en?"Saving…":"Сохранение…"):(en?"Save promo code":"Сохранить промокод")}</button>
    </section>
   </>}
  </div>
 </main>;
}
