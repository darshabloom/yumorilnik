"use client";

import { useState } from "react";
import { addToCart } from "@/src/lib/cart";

type AddToCartButtonProps = {
    ticketTypeId: string;
    eventSlug: string;
    eventTitle: string;
    ticketName: string;
    unitPriceCents: number;
    currency: string;
    remaining: number;
};

export function AddToCartButton({
    ticketTypeId,
    eventSlug,
    eventTitle,
    ticketName,
    unitPriceCents,
    currency,
    remaining,
}: AddToCartButtonProps) {
    const [quantity, setQuantity] = useState(1);
    const [added, setAdded] = useState(false);

    function handleAddToCart() {
        addToCart({
            ticketTypeId,
            eventSlug,
            eventTitle,
            ticketName,
            unitPriceCents,
            currency,
            quantity,
        });

        setAdded(true);
    }

    return (
        <div className="mt-8">
            <div className="flex items-center gap-4">
                <button
                    type="button"
                    onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                    className="border border-black px-4 py-3 text-xl font-bold"
                >
                    −
                </button>

                <span className="min-w-8 text-center text-xl font-bold">
                    {quantity}
                </span>

                <button
                    type="button"
                    onClick={() =>
                        setQuantity((current) => Math.min(remaining, current + 1))
                    }
                    className="border border-black px-4 py-3 text-xl font-bold"
                >
                    +
                </button>
            </div>

            <button
                type="button"
                onClick={handleAddToCart}
                disabled={remaining <= 0}
                className="mt-5 bg-black px-6 py-4 font-bold text-[#f5a047] disabled:cursor-not-allowed disabled:opacity-50"
            >
                {remaining <= 0 ? "Билеты закончились" : "Добавить в корзину"}
            </button>

            {added && (
                <div className="mt-5 rounded-2xl border border-black bg-[#f7b15d] p-4">
                    <p className="font-bold">Добавлено в корзину.</p>

                    <a href="/cart" className="mt-3 inline-block underline">
                        Перейти в корзину →
                    </a>
                </div>
            )}
        </div>
    );
}