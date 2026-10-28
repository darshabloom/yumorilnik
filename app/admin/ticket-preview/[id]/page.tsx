"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {useParams,useRouter} from "next/navigation";
import {supabase} from "@/lib/supabaseClient";
import {useSiteLanguage} from "@/lib/useSiteLanguage";
type Guest={guest_index:number;full_name:string;category:string;is_child_with_adult_seat:boolean|null;childcare_hours:number|null;checked_in_at:string|null};
type Seat={guest_index:number|null;table_label:string;seat_number:number|null};
type Booking={booking_reference:string;status:string;events:{title:string;event_date:string;event_time:string|null;location:string|null;slug:string}|null;booking_guests:Guest[];booking_selections:Seat[]};
export default function TicketPreview(){
 const {id}=useParams<{id:string}>(),router=useRouter(),en=useSiteLanguage()==="en";
 const [codes,setCodes]=useState<Record<number,string>>({});
 const [booking,setBooking]=useState<Booking|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState("");
 useEffect(()=>{let live=true;void(async()=>{try{
  const {data:{user}}=await supabase.auth.getUser();if(!user){router.replace("/login");return}
  const {data:role,error:roleError}=await supabase.from("admin_users").select("role").eq("user_id",user.id).maybeSingle();
  if(roleError||!role||!["owner","admin"].includes(role.role))throw Error("Organiser access required");
  const {data,error:readError}=await supabase.from("bookings").select("booking_reference,status,events(title,event_date,event_time,location,slug),booking_guests(guest_index,full_name,category,is_child_with_adult_seat,childcare_hours,checked_in_at),booking_selections(guest_index,table_label,seat_number)").eq("id",id).maybeSingle();
  if(readError)throw readError;if(!data)throw Error("Booking not found");
  if(live)setBooking(data as unknown as Booking);
 }catch(e){if(live)setError(e instanceof Error?e.message:String(e))}finally{if(live)setLoading(false)}})();return()=>{live=false}},[id,router]);
 async function requestCode(index:number){
  try{
   const {data:{session}}=await supabase.auth.getSession();
   if(!session)throw Error("Authentication required");
   const response=await fetch("/api/tickets/credentials",{method:"POST",headers:{"Authorization":"Bearer "+session.access_token,"Content-Type":"application/json"},body:JSON.stringify({action:"issue",bookingId:id,guestIndex:index})});
   const data=await response.json() as {credential?:string;error?:string};
   if(!response.ok||!data.credential)throw Error(data.error??"Unavailable");
   setCodes(previous=>({...previous,[index]:data.credential!}));
  }catch(e){setError(e instanceof Error?e.message:"Unable to issue code")}
 }
 async function downloadPdf(){
  try{const {data:{session}}=await supabase.auth.getSession();if(!session)throw Error("Sign in required");
   const res=await fetch("/api/admin/ticket-pdf?bookingId="+encodeURIComponent(id),{headers:{"Authorization":"Bearer "+session.access_token}});
   if(!res.ok){const detail=await res.json() as {error?:string};throw Error(detail.error??"PDF unavailable")}
   const blob=await res.blob();const url=URL.createObjectURL(blob);const a=document.createElement("a");
   a.href=url;a.download="yumorilnik-tickets.pdf";document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
  }catch(e){setError(e instanceof Error?e.message:"Unable to download PDF")}
 }
 return <main className="min-h-screen bg-[#fff2db] px-5 py-8 text-black"><section className="mx-auto max-w-3xl rounded-2xl border border-black bg-white p-6 print:border-0 print:p-0">
 <div className="print:hidden"><Link href="/admin/bookings" className="underline">{en?"← Bookings":"← Брони"}</Link></div>
 <h1 className="mt-4 text-3xl font-black">Юморильник · {en?"Ticket preview":"Просмотр билета"}</h1>
 {loading?<p>{en?"Loading…":"Загрузка…"}</p>:error?<p role="alert" className="mt-5 text-red-700">{error}</p>:booking&&<>
 <p className="mt-4 font-semibold">{booking.events?.title??"Event"}</p>
 <p>{booking.events?.event_date} · {booking.events?.event_time??""}</p>
 {booking.events?.location&&<p>{booking.events.location}</p>}
 {booking.events?.slug&&<Link href={"/events/"+encodeURIComponent(booking.events.slug)} className="underline print:hidden">{en?"Event details":"Информация о мероприятии"}</Link>}
 <p className="mt-4">{en?"Booking reference":"Номер брони"}: <strong>{booking.booking_reference}</strong></p>
 <p className="mt-2 font-bold text-red-800">{booking.status==="test_confirmed"?(en?"SANDBOX — INVALID FOR ENTRY":"ТЕСТ — НЕДЕЙСТВИТЕЛЬНЫЙ БИЛЕТ"):booking.status!=="confirmed"?(en?"NOT AN ACTIVE TICKET":"БИЛЕТ НЕДЕЙСТВИТЕЛЕН"):(en?"VALID ADMISSION TICKET — PRESENT QR AT STAFF CHECK-IN":"ДЕЙСТВИТЕЛЬНЫЙ БИЛЕТ — ПОКАЖИТЕ QR-КОД ПРИ ВХОДЕ")}</p>
 <div className="mt-5 space-y-3">{booking.booking_guests.map(g=>{const seat=booking.booking_selections.find(s=>s.guest_index===g.guest_index);return <article key={g.guest_index} className="rounded-lg border p-4">
 <p className="font-bold">{g.full_name}</p><p>{g.is_child_with_adult_seat?(en?"Child in adult-priced seat":"Ребёнок на взрослом месте"):g.category==="child"?(en?"Childcare":"Присмотр"):(en?"Adult":"Взрослый")}</p>
 <p>{seat?`${en?"Table":"Стол"} ${seat.table_label} · ${en?"seat":"место"} ${seat.seat_number??"—"}`:(en?"No assigned seat":"Без закреплённого места")}</p>
 {g.childcare_hours&&<p>{en?"Childcare":"Присмотр"}: {g.childcare_hours}h</p>}
 <p>{g.checked_in_at?(en?"Checked in":"Зарегистрирован"):(en?"Not checked in":"Не зарегистрирован")}</p>
 {booking.status==="confirmed"&&<div className="mt-3 print:hidden"><button type="button" className="rounded border px-3 py-2" onClick={()=>void requestCode(g.guest_index)}>{en?"Get check-in credential":"Получить код регистрации"}</button>{codes[g.guest_index]&&<p className="mt-2 break-all text-xs">{codes[g.guest_index]}</p>}</div>}
 </article>})}</div>
 <div className="mt-6 flex flex-wrap gap-3 print:hidden"><button type="button" className="rounded-lg bg-black px-5 py-3 font-semibold text-white" onClick={()=>void downloadPdf()}>{en?"Download ticket PDF":"Скачать билеты PDF"}</button><button type="button" onClick={()=>window.print()} className="rounded-lg border border-black px-5 py-3 font-semibold">{en?"Print preview":"Распечатать просмотр"}</button></div>
 </>}
 </section></main>;
}