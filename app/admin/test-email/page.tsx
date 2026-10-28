"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {supabase} from "@/lib/supabaseClient";
import {useSiteLanguage} from "@/lib/useSiteLanguage";
export default function TestEmailPage(){
 const en=useSiteLanguage()==="en";
 const [bookings,setBookings]=useState<{id:string;booking_reference:string;status:string}[]>([]),[selected,setSelected]=useState("");
 const [allowed,setAllowed]=useState(false),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
 useEffect(()=>{let active=true;void(async()=>{const {data:{user}}=await supabase.auth.getUser();if(user){const {data}=await supabase.from("admin_users").select("role").eq("user_id",user.id).maybeSingle();if(active)setAllowed(Boolean(data&&["owner","admin"].includes(data.role)));if(data&&["owner","admin"].includes(data.role)){const {data:rows}=await supabase.from("bookings").select("id,booking_reference,status").in("status",["confirmed","test_confirmed"]).order("created_at",{ascending:false}).limit(30);if(active)setBookings(rows??[])}}if(active)setLoading(false)})();return()=>{active=false}},[]);
 async function samplePdf(){
  setError("");
  try{const {data:{session}}=await supabase.auth.getSession();if(!session)throw Error("Sign in required");
  const res=await fetch("/api/admin/ticket-pdf?sample=true",{headers:{"Authorization":"Bearer "+session.access_token}});
  if(!res.ok)throw Error("Unable to generate PDF sample");
  const file=await res.blob(),url=URL.createObjectURL(file),a=document.createElement("a");
  a.href=url;a.download="yumorilnik-cyrillic-sample.pdf";a.click();URL.revokeObjectURL(url);
  }catch(e){setError(e instanceof Error?e.message:"PDF test failed")}
 }
 async function send(){
  setBusy(true);setError("");setMessage("");
  try{const {data:{session}}=await supabase.auth.getSession();if(!session)throw Error("Sign in required");
   const response=await fetch("/api/admin/test-confirmation-email",{method:"POST",headers:{"Authorization":"Bearer "+session.access_token,"Content-Type":"application/json"},body:JSON.stringify(selected?{bookingId:selected}:{})});
   const result=await response.json() as {ok?:boolean;to?:string;error?:string};
   if(!response.ok)throw Error(result.error??"Email send failed");
   setMessage((en?"Test email accepted for delivery to ":"Тестовое письмо принято к отправке на ")+(result.to??""));
  }catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}
 }
 return <main className="min-h-[75vh] bg-[#fff2db] px-5 py-10 text-black"><section className="mx-auto max-w-2xl rounded-xl border border-black bg-white p-6">
 <Link href="/admin" className="underline">{en?"← Dashboard":"← Панель управления"}</Link>
 <h1 className="mt-5 text-3xl font-black">{en?"Test confirmation email":"Тестовое письмо с подтверждением"}</h1>
 <p className="mt-3">{en?"Send a sample ticket confirmation to your signed-in organiser email. This test creates no real booking or ticket. Matryoshka linking is a preview only.":"Отправить образец подтверждения на почту администратора. Тест не создаёт настоящую бронь или билет. Связь с Matryoshka пока показана только как пример."}</p>
 {allowed&&<label className="mt-5 block font-semibold">{en?"Select booking data for the preview":"Данные брони для теста"}<select className="mt-2 w-full rounded border border-black p-3" value={selected} onChange={e=>setSelected(e.target.value)}><option value="">{en?"Sample booking (fictional)":"Пример брони (вымышленный)"}</option>{bookings.map(b=><option key={b.id} value={b.id}>{b.booking_reference} · {b.status==="test_confirmed"?"SANDBOX":"confirmed"}</option>)}</select><p className="mt-2 text-sm text-gray-600">{en?"Email always goes only to your organiser account, never the customer.":"Письмо отправляется только администратору, а не покупателю."}</p></label>}
 {loading?<p className="mt-4">{en?"Checking access…":"Проверяем доступ…"}</p>:allowed?<button disabled={busy} onClick={()=>void send()} className="mt-6 rounded-lg bg-black px-6 py-4 font-bold text-white disabled:opacity-50">{busy?(en?"Sending…":"Отправляем…"):(en?"Send test email to me":"Отправить тестовое письмо себе")}</button>:<p className="mt-6 text-red-800">{en?"Organiser access required.":"Требуется доступ организатора."}</p>}
 {allowed&&<button type="button" onClick={()=>void samplePdf()} className="ml-2 mt-6 rounded-lg border border-black px-5 py-4 font-bold">{en?"Download Cyrillic PDF test":"Скачать PDF-тест кириллицы"}</button>}
 {message&&<p role="status" className="mt-4 rounded bg-green-50 p-3">{message}</p>}
 {error&&<p role="alert" className="mt-4 rounded bg-red-50 p-3">{error}</p>}
 </section></main>;
}
