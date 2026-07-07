export default function ProductsPage() {
    return (
        <main className="min-h-screen bg-[#f5a047] px-6 py-16 text-black">
            <section className="mx-auto max-w-5xl">
                <a href="/" className="text-lg font-bold underline">
                    ← На главную
                </a>

                <h1 className="mt-10 text-5xl font-black text-pink-600">Билеты</h1>

                <article className="mt-12 grid gap-8 rounded-[32px] border border-black bg-[#f7b15d] p-8 md:grid-cols-3">
                    <div className="aspect-square rounded-[24px] bg-black/20" />

                    <div className="md:col-span-2">
                        <p className="text-lg font-bold">31 декабря 2025 · 19:00</p>
                        <h2 className="mt-4 text-3xl font-black">Новогодник 2026</h2>
                        <p className="mt-5 text-lg">
                            Новогодний вечер с музыкой, юмором, танцами и праздничной
                            атмосферой.
                        </p>

                        <p className="mt-6 text-2xl font-black">$120.00</p>

                        <a
                            href="/products/p/novogodnik2026"
                            className="mt-8 inline-block bg-black px-6 py-4 font-bold text-[#f5a047]"
                        >
                            Подробнее
                        </a>
                    </div>
                </article>
            </section>
        </main>
    );
}