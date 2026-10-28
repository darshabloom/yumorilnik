"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {supabase} from "@/lib/supabaseClient";
import {useSiteLanguage} from "@/lib/useSiteLanguage";
export default function AccountPage(){
 const en=useSiteLanguage()==="en",router=useRouter();
 const [loading,setLoading]=useState(true),[email,setEmail]=useState(""),[admin,setAdmin]=useState(false),[staff,setStaff]=useState(false),[error,setError]=useState("");
 useEffect(()=>{let active=true;void(async()=>{try{
  const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError||!user){router.replace("/login");return;}
  if(!active)return;setEmail(user.email??"");
  const {data:membership,error:roleError}=await supabase.from("admin_users").select("role").eq("user_id",user.id).maybeSingle();
  if(roleError)throw roleError;
  if(membership&&["owner","admin"].includes(membership.role)){setAdmin(true);setStaff(true);}
  else {const {data,error:staffError}=await supabase.rpc("staff_available_events");if(!staffError&&Array.isArray(data)&&data.length>0)setStaff(true);}
 }catch(e){if(active)setError(e instanceof Error?e.message:String(e))}finally{if(active)setLoading(false)}})();return()=>{active=false}},[router]);
 async function signOut(){await supabase.auth.signOut();router.replace("/login");router.refresh();}
 return <main className="min-h-[75vh] bg-[#fff2db] px-5 py-10 text-black"><section className="mx-auto max-w-3xl space-y-5">
  <h1 className="text-3xl font-black">{en?"My account":"Мой аккаунт"}</h1>
  {loading?<p>{en?"Checking your account…":"Проверяем аккаунт…"}</p>:<>
   <p className="break-all text-gray-700">{email}</p>
   {error&&<p role="alert" className="rounded bg-red-100 p-3">{error}</p>}
   <div className="grid gap-3 sm:grid-cols-2">
    {admin&&<Link href="/admin" className="rounded-xl border-2 border-black bg-white p-5 font-bold">{en?"Organiser dashboard →":"Панель организатора →"}</Link>}
    {staff&&<Link href="/staff/check-in" className="rounded-xl border-2 border-black bg-white p-5 font-bold">{en?"Event check-in →":"Регистрация гостей →"}</Link>}
    <div className="rounded-xl border-2 border-black bg-white p-5"><h2 className="font-bold">{en?"My bookings":"Мои брони"}</h2><p className="mt-2 text-sm text-gray-600">{en?"Account-linked booking history is being prepared. Keep your booking confirmation email and reference in the meantime.":"История бронирований в аккаунте готовится. Пока сохраните письмо-подтверждение и номер брони."}</p></div>
   </div>
   <button type="button" onClick={()=>void signOut()} className="rounded-lg border border-black px-5 py-3 font-semibold">{en?"Sign out":"Выйти"}</button>
  </>}
 </section></main>;
}