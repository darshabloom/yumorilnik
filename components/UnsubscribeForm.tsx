"use client";

import {useState} from "react";
import Link from "next/link";
import {supabase} from "@/lib/supabaseClient";
import {useSiteLanguage} from "@/lib/useSiteLanguage";

export default function UnsubscribeForm({token}:{token:string}){
 const en=useSiteLanguage()==="en";
 const [busy,setBusy]=useState(false);
 const [result,setResult]=useState<"idle"|"done"|"invalid"|"error">("idle");
 const valid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);
 async function unsubscribe(){
  if(!valid||busy)return;
  setBusy(true);setResult("idle");
  try{
   const {data,error}=await supabase.rpc("marketing_unsubscribe",{p_token:token});
   if(error)throw error;
   setResult(data===true?"done":"invalid");
  }catch{setResult("error")}
  finally{setBusy(false)}
 }
 return <main className="flex min-h-[70vh] items-center justify-center bg-[#fff2db] px-4 py-12 text-black">
  <section className="w-full max-w-lg space-y-5 rounded-2xl border border-black/20 bg-white p-6 sm:p-10">
   <h1 className="text-3xl font-black">{en?"Stop future invitations":"Отписаться от приглашений"}</h1>
   <p className="text-gray-700">{en?"Stop receiving marketing invitations to future Yumorilnik and Marina events. This will not cancel any booking or affect essential event messages.":"Откажитесь от рекламных приглашений на будущие мероприятия Юморильника и Марины. Это не отменит ваши бронирования и не затронет важные сообщения о мероприятиях."}</p>
   {result==="done"?<p role="status" className="rounded-lg bg-green-50 p-4 font-semibold text-green-900">{en?"Unsubscribed. You will not be included in future invitations.":"Вы отписались. Мы больше не будем присылать приглашения."}</p>:
    result==="invalid"||!valid?<p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">{en?"This unsubscribe link is invalid. Contact the organiser to opt out.":"Ссылка отписки неверна. Свяжитесь с организатором, чтобы отказаться от писем."}</p>:
    <><button type="button" disabled={busy} onClick={()=>void unsubscribe()} className="min-h-12 w-full rounded-lg bg-black px-5 py-4 font-bold text-white disabled:opacity-50">{busy?(en?"Unsubscribing…":"Отписываем…"):(en?"Unsubscribe from marketing":"Отписаться от рассылки")}</button>
    {result==="error"&&<p role="alert" className="text-sm text-red-800">{en?"Unable to complete the request. Please retry or contact Marina.":"Не получилось отписаться. Повторите попытку или свяжитесь с Мариной."}</p>}</>}
   <Link href="/" className="inline-block font-semibold underline">{en?"← Return to Yumorilnik":"← Вернуться на Юморильник"}</Link>
  </section>
 </main>;
}
