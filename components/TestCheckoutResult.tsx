"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {useSiteLanguage} from "@/lib/useSiteLanguage";

type Status={
 state:"creating"|"open"|"test_paid"|"expired"|"needs_review";
 reference:string|null;paymentStatus:string;sessionStatus:string;isRealTicket:false;
};
export default function TestCheckoutResult({sessionId}:{sessionId:string}){
 const en=useSiteLanguage()==="en";
 const [result,setResult]=useState<Status|null>(null);
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 async function refresh(){
  if(!sessionId)return;
  setBusy(true);setError("");
  try{
   const response=await fetch("/api/checkout/test/status?session_id="+encodeURIComponent(sessionId),{cache:"no-store"});
   const body=await response.json() as Status&{error?:string};
   if(!response.ok)throw new Error(body.error||"Unable to check payment");
   setResult(body);
  }catch(e){setError(e instanceof Error?e.message:"Unknown error")}
  finally{setBusy(false)}
 }
 useEffect(()=>{void refresh();},[sessionId]);
 const done=result?.state==="test_paid";
 return <main className="min-h-[75vh] bg-[#fff2db] px-4 py-10 text-black">
  <div className="mx-auto max-w-2xl space-y-5 rounded-2xl border-2 border-black bg-white p-6 sm:p-9">
   <p className="text-sm font-bold uppercase tracking-widest text-pink-700">{en?"Yumorilnik payment sandbox":"Тестовая оплата Юморильник"}</p>
   <h1 className="text-3xl font-black">{done?(en?"Test payment recorded":"Тестовая оплата записана"):(en?"Checking your test payment":"Проверяем тестовую оплату")}</h1>
   <p className="rounded-lg border border-amber-400 bg-amber-50 p-4 font-semibold">{en?
    "SANDBOX ONLY: No real payment was collected. This is not a valid event ticket or seat reservation.":
    "ТОЛЬКО ТЕСТ: Настоящие деньги не списаны. Это не действующий билет и не бронь места."}</p>
   {!sessionId&&<p role="alert" className="rounded-lg bg-amber-50 p-4 text-sm">{en?"No Stripe session identifier was supplied. Return to the event and restart the test checkout.":"Не указан номер сессии Stripe. Вернитесь к мероприятию и начните тестовую оплату заново."}</p>}
   {result?.reference&&<p>{en?"Test reference":"Тестовый номер"}: <strong>{result.reference}</strong></p>}
   {result?.state==="needs_review"&&<p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-800">{en?
    "The test payment was received but booking reconciliation needs administrator review. No ticket was issued.":
    "Тестовый платёж получен, но бронирование требует проверки администратора. Билет не выпущен."}</p>}
   {result?.state==="expired"&&<p className="rounded-lg bg-amber-50 p-4 text-sm">{en?"The test payment session expired; its seat hold was released.":"Тестовая сессия истекла; временное удержание места снято."}</p>}
   {result&&!done&&!["expired","needs_review"].includes(result.state)&&<p className="text-sm">{en?
    "Stripe may have completed payment, but the verified webhook has not confirmed the sandbox booking yet. Please use Refresh status.":
    "Stripe мог обработать оплату, но подтверждение вебхуком ещё не получено. Нажмите «Обновить статус»."}</p>}
   {error&&<p role="alert" className="rounded-lg bg-red-100 p-4 text-sm text-red-900">{error}</p>}
   <div className="flex flex-wrap gap-3">
    <button type="button" onClick={()=>void refresh()} disabled={busy||!sessionId} className="rounded-lg bg-black px-5 py-3 font-bold text-white disabled:opacity-50">{busy?(en?"Checking…":"Проверяем…"):(en?"Refresh status":"Обновить статус")}</button>
    <Link href="/events" className="rounded-lg border border-black px-5 py-3 font-bold">{en?"Back to events":"Вернуться к афише"}</Link>
   </div>
  </div>
 </main>;
}
