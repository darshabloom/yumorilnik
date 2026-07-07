import { supabaseServer } from "@/lib/supabaseServer";
import { AddToCartButton } from "@/src/components/AddToCartButton";

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

export default async function NovogodnikProductPage() {
    const { data: event, error } = await supabaseServer
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
        .eq("slug", "novogodnik2026")
        .eq("is_active", true)
        .eq("ticket_types.is_active", true)
        .single();

    if (error || !event) {
        return (
            <main className="min-h-screen bg-[#f5a047] px-6 py-16 text-black">
                <section className="mx-auto max-w-5xl">
                    <a href="/products" className="text-lg font-bold underline">
                        ← Назад к билетам
                    </a>

                    <h1 className="mt-10 text-5xl font-black text-pink-600">
                        Билет не найден
                    </h1>

                    <p className="mt-8 text-lg">
                        Проверь, что событие с slug <strong>novogodnik2026</strong> есть в
                        Supabase.
                    </p>

                    {error && (
                        <pre className="mt-6 overflow-x-auto rounded-2xl bg-black p-4 text-sm text-white">
                            {error.message}
                        </pre>
                    )}
                </section>
            </main>
        );
    }

    const typedEvent = event as EventWithTickets;
    const ticket = typedEvent.ticket_types[0];
    const remaining = ticket.quantity_total - ticket.quantity_sold;

    return (
        <main className="min-h-screen bg-[#f5a047] px-6 py-16 text-black">
            <section className="mx-auto max-w-5xl">
                <a href="/products" className="text-lg font-bold underline">
                    ← Назад к билетам
                </a>

                <div className="mt-12 grid gap-10 md:grid-cols-2">
                    <div className="flex aspect-square items-center justify-center rounded-[32px] bg-black/20 p-8 text-center font-bold">
                        Афиша / фото события
                    </div>

                    <div>
                        <h1 className="text-5xl font-black text-pink-600">
                            {typedEvent.title}
                        </h1>

                        <p className="mt-6 text-lg">
                            {typedEvent.event_date} · {typedEvent.event_time.slice(0, 5)}
                        </p>

                        {typedEvent.location && (
                            <p className="mt-3 text-lg">
                                <strong>Место:</strong> {typedEvent.location}
                            </p>
                        )}

                        {typedEvent.description && (
                            <p className="mt-6 text-lg">{typedEvent.description}</p>
                        )}

                        <div className="mt-8 rounded-[28px] border border-black bg-[#f7b15d] p-6">
                            <h2 className="text-2xl font-black">{ticket.name}</h2>

                            {ticket.description && (
                                <p className="mt-3 text-lg">{ticket.description}</p>
                            )}

                            <p className="mt-5 text-3xl font-black">
                                {formatPrice(ticket.price_cents, ticket.currency)}
                            </p>

                            <p className="mt-2 text-sm font-bold">
                                Осталось билетов: {remaining}
                            </p>

                            <AddToCartButton
                                ticketTypeId={ticket.id}
                                eventSlug={typedEvent.slug}
                                eventTitle={typedEvent.title}
                                ticketName={ticket.name}
                                unitPriceCents={ticket.price_cents}
                                currency={ticket.currency}
                                remaining={remaining}
                            />
                        </div>
                    </div>
                </div>
            </section>
        </main>
    );
}