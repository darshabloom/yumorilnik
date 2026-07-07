const performers = [
    "Ольга Андропова",
    "Наталья Неринг",
    "Александр Петропавловский",
    "Константин Плотников",
    "Михаил Стейнер",
    "Артур Тумма",
    "Марина Блум",
    "Юлия Ходжсон",
];

export default function LineUpPage() {
    return (
        <main className="min-h-screen bg-[#f5a047] px-6 py-16 text-black">
            <section className="mx-auto max-w-6xl">
                <a href="/" className="text-lg font-bold underline">
                    ← На главную
                </a>

                <h1 className="mt-10 text-5xl font-black text-pink-600">Юмористы</h1>

                <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                    {performers.map((performer) => (
                        <article
                            key={performer}
                            className="rounded-[28px] border border-black bg-[#f7b15d] p-6"
                        >
                            <div className="mb-5 aspect-square rounded-[22px] bg-black/20" />
                            <h2 className="text-xl font-black">{performer}</h2>
                        </article>
                    ))}
                </div>
            </section>
        </main>
    );
}