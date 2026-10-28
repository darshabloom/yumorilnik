"use client";
import {useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {supabase} from "@/lib/supabaseClient";
import {useSiteLanguage} from "@/lib/useSiteLanguage";
export default function StaffLogin(){
 const en=useSiteLanguage()==="en";
 const router=useRouter();
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 async function login(){
  setBusy(true);setError("");
  const {data:{user}}=await supabase.auth.getUser();
  if(user){router.push("/staff/check-in");return;}
  const result=await supabase.auth.signInWithOAuth({provider:"google",
   options:{redirectTo:`${window.location.origin}/staff/check-in`}});
  if(result.error){setError(result.error.message);setBusy(false);}
 }
 return <main className="flex min-h-[75vh] items-center justify-center bg-[#fff2db] p-5 text-black">
  <section className="w-full max-w-md space-y-5 rounded-2xl border-2 border-black bg-white p-6 shadow-[6px_6px_0_#171717]">
   <Link href="/" className="text-sm font-semibold underline">{en?"← Website":"← На сайт"}</Link>
   <h1 className="text-3xl font-black">{en?"Event staff check-in":"Регистрация гостей"}</h1>
   <p className="text-sm">{en?"Sign in with the Google account Marina authorised for event check-in. Staff access only shows confirmed guests, assigned seats and child supervision hours.":"Войдите через Google-аккаунт, которому Марина предоставила доступ. Персонал видит только подтверждённых гостей, места и часы присмотра за детьми."}</p>
   {error&&<p role="alert" className="rounded bg-red-100 p-3 text-sm text-red-900">{error}</p>}
   <button type="button" disabled={busy} onClick={()=>void login()} className="w-full rounded-lg bg-black p-4 font-bold text-white disabled:opacity-50">{en?"Continue with Google":"Продолжить через Google"}</button>
  </section>
 </main>;
}
