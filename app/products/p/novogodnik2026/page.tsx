export default function NovogodnikProductPage() {
    return (
        <main className="min-h-screen bg-[#f5a047] px-6 py-16 text-black">
            <section className="mx-auto max-w-5xl">
                <a href="/products" className="text-lg font-bold underline">
                    ← Назад к билетам
                </a>

                <div className="mt-12 grid gap-10 md:grid-cols-2">
                    <div className="aspect-square rounded-[32px] bg-black/20" />

                    <div>
                        <h1 className="text-5xl font-black text-pink-600">
                            Новогодник 2026
                        </h1>

                        <p className="mt-6 text-xl font-bold">$120.00</p>

                        <p className="mt-6 text-lg">
                            Среда, 31 декабря 2025 · 19:00
                        </p>

                        <p className="mt-6 text-lg">
                            Музыка, юмор, танцы и праздничное настроение для русскоязычного
                            сообщества Окленда.
                        </p>

                        <button className="mt-8 bg-black px-6 py-4 font-bold text-[#f5a047]">
                            Добавить в корзину
                        </button>

                        <p className="mt-5 text-sm">
                            Пока это визуальная кнопка. Настоящую корзину и оплату добавим
                            через Stripe позже.
                        </p>
                    </div>
                </div>
            </section>
        </main>
    );
}