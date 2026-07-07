const faqs = [
    {
        question: "Можно ли прийти без билета?",
        answer: "Лучше купить билет заранее, чтобы место было гарантировано.",
    },
    {
        question: "Можно ли принести еду и напитки?",
        answer: "Условия зависят от конкретного события и площадки.",
    },
    {
        question: "Как связаться с организаторами?",
        answer: "Контакты будут указаны на странице события.",
    },
];

export default function FaqPage() {
    return (
        <main className="min-h-screen bg-[#f5a047] px-6 py-16 text-black">
            <section className="mx-auto max-w-4xl">
                <a href="/" className="text-lg font-bold underline">
                    ← На главную
                </a>

                <h1 className="mt-10 text-5xl font-black text-pink-600">Вопросы</h1>

                <div className="mt-12 space-y-5">
                    {faqs.map((faq) => (
                        <article
                            key={faq.question}
                            className="rounded-[28px] border border-black bg-[#f7b15d] p-6"
                        >
                            <h2 className="text-2xl font-black">{faq.question}</h2>
                            <p className="mt-3 text-lg">{faq.answer}</p>
                        </article>
                    ))}
                </div>
            </section>
        </main>
    );
}