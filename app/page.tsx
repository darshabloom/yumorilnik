export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#f5a047] text-black">
      <section className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-8 md:flex-row md:items-center md:justify-between md:px-10">
        <a href="/" className="text-4xl font-black text-pink-600 md:text-5xl">
          Юморильник
        </a>

        <nav className="flex flex-wrap items-center gap-5 text-base md:gap-8 md:text-lg">
          <a href="/" className="underline underline-offset-8">
            Главная
          </a>
          <a href="/line-up">Юмористы</a>
          <a href="/faq">Вопросы</a>
          <a href="/programme">Программа</a>
          <a
            href="/products"
            className="border border-black px-5 py-3 font-bold"
          >
            Билеты
          </a>
        </nav>
      </section>

      <section className="flex h-[360px] items-center justify-center bg-black px-6 text-center text-[#f5a047] md:h-[520px]">
        <div>
          <p className="text-lg uppercase tracking-[0.3em]">Auckland</p>
          <h1 className="mt-5 text-5xl font-black md:text-7xl">
            Новогодник 2026
          </h1>
          <p className="mt-6 max-w-2xl text-xl font-bold">
            Музыка, юмор, танцы и праздничное настроение — всё, что нужно в эту
            ночь.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-10 px-6 py-20 md:grid-cols-3 md:items-center md:px-10 md:py-28">
        <div>
          <h2 className="text-3xl font-black">31/12/25</h2>
          <p className="mt-4 text-lg">Среда · 19:00</p>
          <p className="mt-2 text-lg">Auckland</p>
        </div>

        <div>
          <h2 className="text-3xl font-black">Новогодний маскарад</h2>
          <p className="mt-5 text-lg font-bold">
            Праздничный вечер для русскоязычного сообщества Окленда: музыка,
            юмор, танцы, общение и новогодняя атмосфера.
          </p>

          <a
            href="/products/p/novogodnik2026"
            className="mt-8 inline-block bg-black px-6 py-4 font-bold text-[#f5a047]"
          >
            Купить билеты
          </a>
        </div>

        <div className="flex aspect-square items-center justify-center rounded-[32px] bg-black/20 p-8 text-center font-bold">
          Здесь будет афиша / фото события
        </div>
      </section>
    </main>
  );
}