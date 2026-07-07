import { supabaseServer } from "@/lib/supabaseServer";

type EventWithTickets = {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    event_date: string;
    event_time: string;
    location: string | null;
    image_url: string | null;
    ticket_types: {
        id: string;
        name: string;
        description: string | null;
        price_cents: number;
        currency: string;
        quantity_total: number;
        quantity_sold: number;
    }[];
};

function formatPrice(priceCents: number, currency: string) {
    return new Intl.NumberFormat("en-NZ", {
        style: "currency",
        currency: currency.toUpperCase(),
    }).format(priceCents / 100);
}

export default async function ProductsPage() {
    const { data: events, error } = await supabaseServer
        .from("events")
        .select(
            `
      id,
      slug,
      title,
      description,
      event_date,
      event_time,
      location,
      image_url,
      ticket_types (
        id,
        name,
        description,
        price_cents,
        currency,
        quantity_total,
        quantity_sold
      )
    `
        )
        .eq("is_active", true)
        .eq("ticket_types.is_active", true)
        .order("event_date", { ascending: true });

    if (error) {
        return (
            <main className="min-h-screen bg-[#f5a047] px-6 py-16 text-black">
                <section className="mx-auto max-w-5xl">
                    <a href="/" className="text-lg font-bold underline">
                        ← На главную
                    </a>

                    <h1 className="mt-10 text-5xl font-black text-pink-600">Билеты</h1>

                    <p className="mt-8 text-lg">
                        Не удалось загрузить билеты. Проверь Supabase keys, RLS policies and
                        table data.
                    </p>

                    <pre className="mt-6 overflow-x-auto rounded-2xl bg-black p-4 text-sm text-white">
                        {error.message}
                    </pre>
                </section>
            </main>
        );
    }

    const activeEvents = (events ?? []) as EventWithTickets[];

    return (
        <main className="min-h-screen bg-[#f5a047] px-6 py-16 text-black">
            <section className="mx-auto max-w-5xl">
                <a href="/" className="text-lg font-bold underline">
                    ← На главную
                </a>

                <h1 className="mt-10 text-5xl font-black text-pink-600">Билеты</h1>

                <div className="mt-12 space-y-8">
                    {activeEvents.map((event) => {
                        const firstTicket = event.ticket_types[0];
                        const remaining =
                            firstTicket.quantity_total - firstTicket.quantity_sold;

                        return (
                            <article
                                key={event.id}
                                className="grid gap-8 rounded-[32px] border border-black bg-[#f7b15d] p-8 md:grid-cols-3"
                            >
                                <div className="flex aspect-square items-center justify-center rounded-[24px] bg-black/20 p-6 text-center font-bold">
                                    Афиша / фото события
                                </div>

                                <div className="md:col-span-2">
                                    <p className="text-lg font-bold">
                                        {event.event_date} · {event.event_time.slice(0, 5)}
                                    </p>

                                    <h2 className="mt-4 text-3xl font-black">{event.title}</h2>

                                    {event.description && (
                                        <p className="mt-5 text-lg">{event.description}</p>
                                    )}

                                    {event.location && (
                                        <p className="mt-4 text-lg">
                                            <strong>Место:</strong> {event.location}
                                        </p>
                                    )}

                                    {firstTicket && (
                                        <>
                                            <p className="mt-6 text-2xl font-black">
                                                {formatPrice(
                                                    firstTicket.price_cents,
                                                    firstTicket.currency
                                                )}
                                            </p>

                                            <p className="mt-2 text-sm font-bold">
                                                Осталось билетов: {remaining}
                                            </p>
                                        </>
                                    )}

                                    <a
                                        href={`/products/p/${event.slug}`}
                                        className="mt-8 inline-block bg-black px-6 py-4 font-bold text-[#f5a047]"
                                    >
                                        Подробнее
                                    </a>
                                </div>
                            </article>
                        );
                    })}
                </div>
            </section>
        </main>
    );
}