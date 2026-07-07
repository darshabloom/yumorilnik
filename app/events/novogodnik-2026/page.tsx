export default function NovogodnikEventPage() {
    return (
        <main className="min-h-screen bg-[#f5a047] px-6 py-16 text-black">
            <section className="mx-auto max-w-4xl">
                <h1 className="text-5xl font-black text-pink-600">
                    Новогодник 2026
                </h1>

                <p className="mt-8 text-xl">
                    Среда, 31 декабря 2025 · 19:00
                </p>

                <p className="mt-6 text-lg">
                    Музыка, юмор, танцы и праздничное настроение.
                </p>

                <a
                    href="/products/p/novogodnik2026"
                    className="mt-8 inline-block bg-black px-6 py-4 font-bold text-[#f5a047]"
                >
                    Купить билеты
                </a>
            </section>
        </main>
    );
}