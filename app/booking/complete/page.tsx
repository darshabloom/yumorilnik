"use client";

import {Suspense,useCallback,useEffect,useState} from "react";
import Link from "next/link";
import {useSearchParams} from "next/navigation";
import {useSiteLanguage} from "@/lib/useSiteLanguage";

type Confirmed={
 state:"confirmed";stripePaid:true;reference:string;paidCents:number;currency:string;
 event:{title:string;date:string|null;time:string|null;location:string|null};
 guests:{name:string;category:string;seats:{table:string;seat:number|null}[]}[];
 confirmationEmailStatus:string;emailSendingEnabled:boolean;matryoshkaUrl:string;message?:string;
};
type Status=Confirmed|{state:string;stripePaid?:boolean;message?:string;error?:string};

function PaymentResult(){
 const params=useSearchParams();
 const sessionId=params.get("session_id")??"";
 const en=useSiteLanguage()==="en";
 const [result,setResult]=useState<Status|null>(null);
 const [loading,setLoading]=useState(true);
 const [attempts,setAttempts]=useState(0);
 const [copied,setCopied]=useState(false);
 const [downloading,setDownloading]=useState(false);
 const [downloadError,setDownloadError]=useState("");
 const check=useCallback(async()=>{
  if(!/^cs_live_[A-Za-z0-9_]{12,200}$/.test(sessionId)){
   setResult({state:"error",message:"The Stripe checkout session is missing"});
   setLoading(false);return;
  }
  try{
   const response=await fetch("/api/checkout/live/status",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({sessionId}),cache:"no-store",
   });
   const data=await response.json() as Status;
   setResult(response.ok?data:{state:"error",message:(data as {error?:string}).error||"Verification temporarily unavailable"});
  }catch{setResult({state:"error",message:"Could not contact the booking service"});}
  finally{setLoading(false);setAttempts(x=>x+1);}
 },[sessionId]);
 useEffect(()=>{void check()},[check]);
 useEffect(()=>{
  if(loading||!result||result.state==="confirmed"||result.state==="needs_review"||result.state==="refunded"||attempts>=12)return;
  const timer=setTimeout(()=>{void check()},4000);
  return()=>clearTimeout(timer);
 },[loading,result,attempts,check]);
 async function downloadTicketPdf(){
  if(downloading||!sessionId)return;
  setDownloading(true);setDownloadError("");
  try{
   const response=await fetch("/api/checkout/live/ticket-pdf",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({sessionId}),cache:"no-store"
   });
   if(!response.ok){
    const payload=await response.json().catch(()=>({error:"Ticket not available"})) as {error?:string};
    throw Error(payload.error||"Ticket PDF is not available");
   }
   const pdf=await response.blob();
   if(pdf.type!=="application/pdf"||pdf.size<300)throw Error("Invalid ticket PDF");
   const url=URL.createObjectURL(pdf);
   const link=document.createElement("a");
   link.href=url;
   link.download="yumorilnik-ticket.pdf";
   document.body.appendChild(link);link.click();link.remove();
   setTimeout(()=>URL.revokeObjectURL(url),30000);
  }catch(error){
   setDownloadError(error instanceof Error?error.message:"Ticket download failed");
  }finally{setDownloading(false);}
 }
 const details=result?.state==="confirmed"?result as Confirmed:null;
 const money=(n:number)=>new Intl.NumberFormat("en-NZ",{style:"currency",currency:"NZD"}).format(n/100);
 return <main className="min-h-[75vh] bg-[#fff9ef] px-4 py-10 text-black sm:px-6">
  <section className="mx-auto max-w-2xl rounded-2xl border border-black/15 bg-white p-6 shadow-sm sm:p-9">
   {details?<div className="space-y-5">
    <div className="rounded-xl bg-green-50 p-4 text-green-900" role="status">
     <p className="text-sm font-bold">✓ {en?"Payment verified · Booking confirmed":"Оплата проверена · Бронь подтверждена"}</p>
     <h1 className="mt-2 text-3xl font-black">{en?"Your event booking":"Ваше бронирование"}</h1>
    </div>
    <div className="rounded-xl border border-black/15 bg-[#fff5e3] p-5">
     <p className="text-xs font-bold uppercase tracking-wider">{en?"Booking reference":"Номер бронирования"}</p>
     <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
      <p className="break-all text-2xl font-black">{details.reference}</p>
      <button type="button" className="rounded border border-black/30 bg-white px-3 py-2 text-sm font-bold" onClick={async()=>{await navigator.clipboard.writeText(details.reference);setCopied(true)}}>{copied?(en?"Copied":"Скопировано"):(en?"Copy reference":"Копировать номер")}</button>
     </div>
    </div>
    <div>
     <h2 className="text-xl font-black">{details.event.title}</h2>
     <p className="mt-1 text-sm text-gray-700">{[details.event.date,details.event.time,details.event.location].filter(Boolean).join(" · ")}</p>
    </div>
    <div>
     <h3 className="font-bold">{en?"Your tickets and seats":"Ваши билеты и места"}</h3>
     <ul className="mt-2 space-y-2">
      {details.guests.map((guest,i)=><li key={i} className="rounded-lg border border-black/10 p-3">
       <strong>{guest.name}</strong> <span className="text-sm text-gray-600">({guest.category==="child"?(en?"Child":"Ребёнок"):(en?"Adult":"Взрослый")})</span>
       <div className="mt-1 text-sm">{guest.seats.length?guest.seats.map((seat,j)=><p key={j}>{seat.table}{seat.seat!=null?` · ${en?"Seat":"Место"} ${seat.seat}`:""}</p>):en?"No assigned seat":"Без закреплённого места"}</div>
      </li>)}
     </ul>
     <p className="mt-3 text-lg font-black">{en?"Paid":"Оплачено"}: {money(details.paidCents)}</p>
     <div className="mt-4 rounded-xl border border-black/15 bg-[#fffaf2] p-4">
      <h3 className="font-black">{en?"Your admission ticket PDF":"Ваш PDF-билет"}</h3>
      <p className="mt-1 text-sm">{en?"Download the same admission ticket with QR code as in your confirmation email. Present the QR code to event staff at check-in.":"Скачайте билет с QR-кодом, как в письме с подтверждением. Покажите QR-код сотруднику на входе."}</p>
      <button type="button" className="mt-3 rounded-lg bg-[#ee9e4d] px-5 py-3 font-black text-black disabled:opacity-60" disabled={downloading} onClick={()=>void downloadTicketPdf()}>
       {downloading?(en?"Preparing PDF…":"Готовим PDF…"):en?"⬇ Download ticket PDF":"⬇ Скачать PDF-билет"}
      </button>
      {downloadError&&<p role="alert" className="mt-2 text-sm font-semibold text-red-700">{downloadError}</p>}
     </div>
    </div>
    <div className="rounded-xl border border-orange-300 bg-orange-50 p-4">
     <h3 className="font-black">{en?"Pre-order food from Matryoshka":"Предзаказ еды в Матрёшке"}</h3>
     <p className="mt-2 text-sm">{en?"Your booking reference will be carried to Matryoshka. You will still enter the booking email so Matryoshka can verify the ticket before accepting an order.":"Номер брони передастся в Матрёшку. Для проверки билета при заказе еды также потребуется указать email из бронирования."}</p>
     <a className="mt-3 inline-block rounded-lg bg-black px-5 py-3 font-bold text-white" href={details.matryoshkaUrl}>{en?"View event food menu →":"Посмотреть меню мероприятия →"}</a>
    </div>
    <div className="rounded-xl border border-black/10 p-4 text-sm">
     <strong>{en?"Ticket email":"Письмо с билетами"}: </strong>
     {details.confirmationEmailStatus==="sent"?(en?"Sent. Check your inbox and spam folder.":"Отправлено. Проверьте почту и папку «Спам»."):
      !details.emailSendingEnabled?(en?"Not sent yet — email delivery has not been enabled by the organiser. Keep your booking reference.":"Пока не отправлено — организатор ещё не включил отправку писем. Сохраните номер брони."):
      details.confirmationEmailStatus==="failed"?(en?"Sending failed. Contact the organiser; do not pay again.":"Не удалось отправить письмо. Свяжитесь с организатором; не платите повторно."):
      en?"Being prepared. Keep this page and booking reference.":"Готовится к отправке. Сохраните эту страницу и номер брони."}
     {details.confirmationEmailStatus!=="sent"&&<button type="button" className="mt-2 text-sm font-semibold underline" onClick={()=>void check()}>{en?"Refresh email status":"Обновить статус письма"}</button>}
     {details.paidCents===50&&<p className="mt-2 text-amber-800">{en?"This was the NZ$0.50 live payment test. A refund is separate and may affect ticket validity.":"Это тест реальной оплаты NZ$0.50. Возврат оформляется отдельно и может повлиять на действительность билета."}</p>}
    </div>
    <Link href="/" className="inline-block text-sm underline">{en?"Back to Yumorilnik":"На главную Юморильника"}</Link>
   </div>:<div className="space-y-4 text-center" role="status">
    <h1 className="text-2xl font-black">{en?"Checking your payment and booking":"Проверяем оплату и бронирование"}</h1>
    <p>{loading?(en?"Verifying with Stripe…":"Проверяем платёж в Stripe…"):
     result?.state==="needs_review"?(en?"Stripe received your payment, but the booking needs organiser review.":"Stripe получил оплату, но бронь требует проверки организатором."):
     result?.state==="refunded"?(en?"This payment has been refunded. Please contact the organiser about the ticket.":"Оплата возвращена. Свяжитесь с организатором по поводу билета."):
     result?.message||(en?"We're checking your booking status.":"Проверяем статус бронирования.")}</p>
    <p className="font-semibold text-amber-800">{en?"If your card was charged, do not pay again. Keep your Stripe receipt.":"Если деньги списаны, не оплачивайте повторно. Сохраните квитанцию Stripe."}</p>
    <button type="button" className="rounded-lg border border-black/40 px-5 py-3 font-bold" disabled={loading} onClick={()=>void check()}>{en?"Check again":"Проверить снова"}</button>
    <p><Link className="text-sm underline" href="/">{en?"Return to homepage":"На главную"}</Link></p>
   </div>}
  </section>
 </main>;
}
export default function Complete(){
 return <Suspense fallback={<main className="p-8 text-center">Checking Stripe payment…</main>}><PaymentResult/></Suspense>;
}
