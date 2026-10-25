import Link from "next/link";
import LocalizedText from "@/components/LocalizedText";

export default function AboutPage(){
 return <main className="min-h-[75vh] bg-[#fffaf1] px-5 py-12 text-black sm:px-10 lg:px-[6vw]">
   <div className="mx-auto max-w-4xl">
     <Link href="/" className="font-bold underline"><LocalizedText ru="← На главную" en="← Home"/></Link>
     <h1 className="mt-10 text-4xl font-black sm:text-6xl"><LocalizedText ru="О Юморильнике" en="About Yumorilnik"/></h1>
     <p className="mt-6 text-lg leading-8"><LocalizedText ru="Юморильник объединяет людей в Окленде на концертах, встречах и других интересных мероприятиях." en="Yumorilnik brings people together in Auckland for concerts, gatherings and other memorable events."/></p>
     <Link href="/events" className="mt-8 inline-block rounded-lg bg-black px-6 py-3 font-bold text-white"><LocalizedText ru="Посмотреть афишу →" en="Explore events →"/></Link>
   </div>
 </main>;
}
