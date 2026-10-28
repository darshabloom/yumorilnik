"use client";
import Link from "next/link";
import {useSiteLanguage} from "@/lib/useSiteLanguage";
export default function TestCheckoutCancelled(){
 const en=useSiteLanguage()==="en";
 return <main className="min-h-[75vh] bg-[#fff2db] px-4 py-10 text-black">
  <section className="mx-auto max-w-xl space-y-4 rounded-2xl border-2 border-black bg-white p-7">
   <h1 className="text-3xl font-black">{en?"Stripe test checkout cancelled":"Тестовая оплата Stripe отменена"}</h1>
   <p>{en?"No payment was made. Your temporary seat hold stays in place until the Stripe test session is verified as expired, to prevent double-booking.":"Оплаты не было. Временное удержание места сохраняется до подтверждённого истечения срока сессии Stripe, чтобы избежать двойной брони."}</p>
   <p className="text-sm font-semibold">{en?"Sandbox bookings are not real event tickets.":"Тестовые бронирования не являются действительными билетами."}</p>
   <Link href="/events" className="inline-block rounded-lg bg-black px-5 py-3 font-bold text-white">{en?"Back to events":"К мероприятиям"}</Link>
  </section>
 </main>;
}
