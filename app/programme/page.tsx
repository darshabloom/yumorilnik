export default function ProgrammePage() {
    return (
        <main className="min-h-screen bg-[#f5a047] px-6 py-16 text-black">
            <section className="mx-auto max-w-4xl">
                <a href="/" className="text-lg font-bold underline">
                    ← На главную
                </a>

                <h1 className="mt-10 text-5xl font-black text-pink-600">Программа</h1>

                <div className="mt-12 space-y-6 rounded-[32px] border border-black bg-[#f7b15d] p-8 text-lg">
                    <p>
                        Программа будет опубликована ближе к дате мероприятия.
                    </p>

                    <p>
                        Вечер обычно включает музыку, юмористические выступления, общение,
                        конкурсы, танцы и праздничную атмосферу.
                    </p>
                </div>
            </section>
        </main>
    );
}