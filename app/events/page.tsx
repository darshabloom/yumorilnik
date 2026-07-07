export default function EventsPage() {
    return (
        <main className="min-h-screen bg-[#f5a047] px-6 py-16 text-black">
            <section className="mx-auto max-w-4xl">
                <h1 className="text-5xl font-black text-pink-600">События</h1>

                <p className="mt-8 text-xl">
                    Все текущие билеты и события находятся на странице билетов.
                </p>

                <a
                    href="/products"
                    className="mt-8 inline-block bg-black px-6 py-4 font-bold text-[#f5a047]"
                >
                    Перейти к билетам
                </a>
            </section>
        </main>
    );
}