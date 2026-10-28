"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {supabase} from "@/lib/supabaseClient";
import {useSiteLanguage} from "@/lib/useSiteLanguage";
export default function LoginPage(){
 const en=useSiteLanguage()==="en",router=useRouter();
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 useEffect(()=>{void supabase.auth.getUser().then(({data})=>{if(data.user)router.replace("/account")}).catch(()=>{});},[router]);
 async function signIn(){
  setBusy(true);setError("");
  const {error:authError}=await supabase.auth.signInWithOAuth({provider:"google",options:{redirectTo:`${window.location.origin}/account`}});
  if(authError){setError(authError.message);setBusy(false)}
 }
 return <main className="flex min-h-[75vh] items-center justify-center bg-[#fff2db] px-4 py-12 text-black"><section className="w-full max-w-lg rounded-2xl border-2 border-black bg-white p-7 shadow-[5px_5px_0_#171717]">
  <Link href="/" className="text-sm underline">{en?"← Home":"← На главную"}</Link>
  <h1 className="mt-5 text-3xl font-black">{en?"Sign in to Yumorilnik":"Вход в Юморильник"}</h1>
  <p className="mt-3 text-gray-700">{en?"One account for customers, event staff and organisers. Your available tools depend on your access.":"Один аккаунт для гостей, персонала и организаторов. Доступные разделы зависят от ваших прав."}</p>
  {error&&<p role="alert" className="mt-4 rounded bg-red-100 p-3 text-red-900">{error}</p>}
  <button type="button" onClick={()=>void signIn()} disabled={busy} className="mt-7 w-full rounded-lg bg-black px-5 py-4 font-bold text-white disabled:opacity-50">{busy?(en?"Signing in…":"Вход…"):(en?"Continue with Google":"Продолжить через Google")}</button>
 </section></main>;
}