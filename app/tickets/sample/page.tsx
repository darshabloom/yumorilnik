import Link from "next/link";

export const metadata = {
 title: "Yumorilnik sample ticket - invalid",
 robots: {index: false, follow: false},
};

export default function SampleTicketPage() {
 return <main className="min-h-[80vh] bg-[#fff2db] px-4 py-10 text-black">
  <section className="mx-auto max-w-2xl rounded-2xl border-4 border-[#f5a047] bg-white p-6 shadow sm:p-10">
   <p className="text-sm font-black uppercase tracking-widest text-[#8d391d]">Yumorilnik / Юморильник</p>
   <h1 className="mt-4 text-3xl font-black sm:text-4xl">Sample online ticket / Образец билета</h1>
   <div className="mt-6 rounded-xl border-2 border-red-600 bg-red-50 p-5 text-center text-xl font-black text-red-800">
    NOT VALID / НЕДЕЙСТВИТЕЛЕН
   </div>
   <dl className="mt-8 grid gap-4">
    <div><dt className="font-bold">Guest / Гость</dt><dd>Sample Guest</dd></div>
    <div><dt className="font-bold">Reference / Номер брони</dt><dd>TEST-YMR-EXAMPLE</dd></div>
    <div><dt className="font-bold">Status / Статус</dt><dd>Design preview only / Только пример оформления</dd></div>
   </dl>
   <p className="mt-7 text-sm leading-relaxed">
    This preview checks the email-to-website journey. It grants no entry, seat or childcare place.
    / Эта страница предназначена только для проверки оформления. Она не даёт права на вход, место или присмотр.
   </p>
   <Link href="/events" className="mt-7 inline-block rounded-lg bg-black px-5 py-3 font-bold text-white">
    Event information / Информация о мероприятиях
   </Link>
  </section>
 </main>;
}
