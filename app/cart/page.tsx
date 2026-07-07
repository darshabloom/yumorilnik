"use client";

import { useEffect, useState } from "react";
import {
    CartItem,
    formatPrice,
    getCart,
    getCartTotalCents,
    removeCartItem,
    updateCartItemQuantity,
} from "@/src/lib/cart";

export default function CartPage() {
    const [items, setItems] = useState<CartItem[]>([]);
    const totalCents = getCartTotalCents(items);
    const currency = items[0]?.currency ?? "nzd";

    useEffect(() => {
        setItems(getCart());
    }, []);

    function handleQuantityChange(ticketTypeId: string, quantity: number) {
        const updatedCart = updateCartItemQuantity(ticketTypeId, quantity);
        setItems(updatedCart);
    }

    function handleRemove(ticketTypeId: string) {
        const updatedCart = removeCartItem(ticketTypeId);
        setItems(updatedCart);
    }

    return (
        <main className="min-h-screen bg-[#f5a047] px-6 py-16 text-black">
            <section className="mx-auto max-w-5xl">
                <a href="/products" className="text-lg font-bold underline">
                    ← Назад к билетам
                </a>

                <h1 className="mt-10 text-5xl font-black text-pink-600">Корзина</h1>

                {items.length === 0 ? (
                    <div className="mt-12 rounded-[32px] border border-black bg-[#f7b15d] p-8">
                        <p className="text-xl font-bold">Корзина пустая.</p>

                        <a
                            href="/products"
                            className="mt-6 inline-block bg-black px-6 py-4 font-bold text-[#f5a047]"
                        >
                            Смотреть билеты
                        </a>
                    </div>
                ) : (
                    <div className="mt-12 space-y-6">
                        {items.map((item) => (
                            <article
                                key={item.ticketTypeId}
                                className="grid gap-6 rounded-[32px] border border-black bg-[#f7b15d] p-6 md:grid-cols-[1fr_auto_auto]"
                            >
                                <div>
                                    <h2 className="text-2xl font-black">{item.eventTitle}</h2>
                                    <p className="mt-2 text-lg">{item.ticketName}</p>
                                    <p className="mt-2 font-bold">
                                        {formatPrice(item.unitPriceCents, item.currency)} each
                                    </p>
                                </div>

                                <div className="flex items-center gap-4">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            handleQuantityChange(
                                                item.ticketTypeId,
                                                item.quantity - 1
                                            )
                                        }
                                        className="border border-black px-4 py-3 text-xl font-bold"
                                    >
                                        −
                                    </button>

                                    <span className="min-w-8 text-center text-xl font-bold">
                                        {item.quantity}
                                    </span>

                                    <button
                                        type="button"
                                        onClick={() =>
                                            handleQuantityChange(
                                                item.ticketTypeId,
                                                item.quantity + 1
                                            )
                                        }
                                        className="border border-black px-4 py-3 text-xl font-bold"
                                    >
                                        +
                                    </button>
                                </div>

                                <div className="text-left md:text-right">
                                    <p className="text-xl font-black">
                                        {formatPrice(
                                            item.unitPriceCents * item.quantity,
                                            item.currency
                                        )}
                                    </p>

                                    <button
                                        type="button"
                                        onClick={() => handleRemove(item.ticketTypeId)}
                                        className="mt-4 underline"
                                    >
                                        Remove
                                    </button>
                                </div>
                            </article>
                        ))}

                        <div className="rounded-[32px] border border-black bg-[#f7b15d] p-8 md:ml-auto md:max-w-md">
                            <div className="flex items-center justify-between gap-8">
                                <span className="text-xl font-bold">Subtotal</span>
                                <span className="text-2xl font-black">
                                    {formatPrice(totalCents, currency)}
                                </span>
                            </div>

                            <button
                                type="button"
                                className="mt-8 w-full bg-black px-6 py-4 font-bold text-[#f5a047]"
                            >
                                Checkout
                            </button>

                            <p className="mt-5 text-sm">
                                Next step: this button will create a server-side order and send
                                the buyer to Stripe checkout.
                            </p>
                        </div>
                    </div>
                )}
            </section>
        </main>
    );
}