"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {supabase} from "@/lib/supabaseClient";
import {useSiteLanguage} from "@/lib/useSiteLanguage";
export default function TestEmailPage(){
 const en=useSiteLanguage()==="en";
 const [allowed,setAllowed]=useState(false),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
 useEffect(()=>{let active=true;void(async()=>{const {data:{user}}=await supabase.auth.getUser();if(user){const {data}=await supabase.from("admin_users").select("role").eq("user_id",user.id).maybeSingle();if(active)setAllowed(Boolean(data&&["owner","admin"].includes(data.role)))}if(active)setLoading(false)})();return()=>{active=false}},[]);
 async function send(){
  setBusy(true);setError("");setMessage("");
  try{const {data:{session}}=await supabase.auth.getSession();if(!session)throw Error("Sign in required");
   const response=await fetch("/api/admin/test-confirmation-email",{method:"POST",headers:{"Authorization":"Bearer "+session.access_token}});
   const result=await response.json() as {ok?:boolean;to?:string;error?:string};
   if(!response.ok)throw Error(result.error??"Email send failed");
   setMessage((en?"Test email accepted for delivery to ":"Тестовое письмо принято к отправке на ")+(result.to??""));
  }catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}
 }
 return <main className="min-h-[75vh] bg-[#fff2db] px-5 py-10 text-black"><section className="mx-auto max-w-2xl rounded-xl border border-black bg-white p-6">
 <Link href="/admin" className="underline">{en?"← Dashboard":"← Панель управления"}</Link>
 <h1 className="mt-5 text-3xl font-black">{en?"Test confirmation email":"Тестовое письмо с подтверждением"}</h1>
 <p className="mt-3">{en?"Send a sample ticket confirmation to your signed-in organiser email. This test creates no real booking or ticket. Matryoshka linking is a preview only.":"Отправить образец подтверждения на почту администратора. Тест не создаёт настоящую бронь или билет. Связь с Matryoshka пока показана только как пример."}</p>
 {loading?<p className="mt-4">{en?"Checking access…":"Проверяем доступ…"}</p>:allowed?<button disabled={busy} onClick={()=>void send()} className="mt-6 rounded-lg bg-black px-6 py-4 font-bold text-white disabled:opacity-50">{busy?(en?"Sending…":"Отправляем…"):(en?"Send test email to me":"Отправить тестовое письмо себе")}</button>:<p className="mt-6 text-red-800">{en?"Organiser access required.":"Требуется доступ организатора."}</p>}
 {message&&<p role="status" className="mt-4 rounded bg-green-50 p-3">{message}</p>}
 {error&&<p role="alert" className="mt-4 rounded bg-red-50 p-3">{error}</p>}
 </section></main>;
}
