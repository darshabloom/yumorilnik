export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#f5a047] text-black">
      <section className="mx-auto flex max-w-6xl items-center justify-between px-10 py-10">
        <div className="text-5xl font-black text-pink-600">
          Юморильник
        </div>

        <nav className="flex items-center gap-8 text-lg">
          <a href="/" className="underline underline-offset-8">
            Главная
          </a>
          <a href="/line-up">Юмористы</a>
          <a href="/login">Login</a>
          <a
            href="/products"
            className="border border-black px-6 py-4 font-bold"
          >
            Билеты
          </a>
        </nav>
      </section>

      <section className="h-[520px] bg-black" />

      <section className="mx-auto grid max-w-4xl grid-cols-3 items-center gap-12 px-10 py-28">
        <div>
          <h2 className="text-2xl font-bold">31/12/25</h2>
          <p className="mt-4 text-lg">Среда 19:00</p>
        </div>

        <div>
          <h2 className="text-2xl font-bold">Новогодник 2026</h2>
          <p className="mt-5 text-lg font-bold">
            Музыка, юмор, танцы и праздничное настроение — всё, что нужно в эту
            ночь!
          </p>

          <a
            href="/products/p/novogodnik2026"
            className="mt-8 inline-block bg-black px-5 py-4 font-bold text-[#f5a047]"
          >
            Билеты
          </a>
        </div>

        <div className="aspect-square rounded-[32px] bg-black/20" />
      </section>
    </main>
  );
}