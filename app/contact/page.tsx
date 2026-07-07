export default function ContactPage() {
    return (
        <main className="min-h-screen bg-[#f5a047] px-6 py-16 text-black">
            <section className="mx-auto max-w-4xl">
                <a href="/" className="text-lg font-bold underline">
                    ← На главную
                </a>

                <h1 className="mt-10 text-5xl font-black text-pink-600">Контакты</h1>

                <div className="mt-12 rounded-[32px] border border-black bg-[#f7b15d] p-8 text-lg">
                    <p>
                        <strong>Email:</strong>{" "}
                        <a href="mailto:yumorilnik@gmail.com" className="underline">
                            yumorilnik@gmail.com
                        </a>
                    </p>

                    <p className="mt-4">
                        <strong>Телефон:</strong> уточнить у Марины
                    </p>
                </div>
            </section>
        </main>
    );
}