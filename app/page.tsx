import Image from "next/image";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#f5a047] text-black">
      <section className="relative h-[360px] overflow-hidden bg-black md:h-[620px]">
        <Image
          src="/images/home/hero.jpg"
          alt="Юморильник"
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/85 via-black/25 to-transparent" aria-hidden="true" />
        <div className="absolute inset-x-0 bottom-0 px-6 pb-7 pt-12 text-white sm:px-10 sm:pb-10 lg:px-16 lg:pb-14">
          <div className="mx-auto max-w-7xl">
            <p className="mb-3 inline-block rounded bg-black/85 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[#ffd08a] sm:text-sm">
              Юморильник · Окленд
            </p>
            <h1 className="max-w-2xl text-3xl font-black leading-tight drop-shadow-lg sm:text-5xl lg:text-6xl">
              Юмор, люди, истории.
            </h1>
            <p className="mt-3 max-w-xl text-sm font-medium leading-relaxed drop-shadow-lg sm:text-lg">
              Встречаемся, смеёмся и делимся тем, что интересно.
            </p>
          </div>
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