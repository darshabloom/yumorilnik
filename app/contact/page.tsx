import LocalizedText from "@/components/LocalizedText";
export default function ContactPage() {
    return (
        <main className="min-h-screen bg-[#f5a047] px-6 py-16 text-black">
            <section className="mx-auto max-w-4xl">
                <a href="/" className="text-lg font-bold underline">
                    <LocalizedText ru="← На главную" en="← Home"/>
                </a>

                <h1 className="mt-10 text-5xl font-black text-pink-600"><LocalizedText ru="Контакты" en="Contact"/></h1>

                <div className="mt-12 rounded-[32px] border border-black bg-[#f7b15d] p-8 text-lg">
                    <p>
                        <strong>Email:</strong>{" "}
                        <a href="mailto:yumorilnik@gmail.com" className="underline">
                            yumorilnik@gmail.com
                        </a>
                    </p>

                    <p className="mt-4">
                        <strong><LocalizedText ru="Телефон:" en="Phone:"/></strong> <LocalizedText ru="уточнить у Марины" en="please contact Marina"/>
                    </p>
                </div>
            </section>
        </main>
    );
}