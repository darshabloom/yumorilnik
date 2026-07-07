export type CartItem = {
    ticketTypeId: string;
    eventSlug: string;
    eventTitle: string;
    ticketName: string;
    unitPriceCents: number;
    currency: string;
    quantity: number;
};

export const CART_STORAGE_KEY = "yumorilnik_cart";

export function getCart(): CartItem[] {
    if (typeof window === "undefined") {
        return [];
    }

    const rawCart = window.localStorage.getItem(CART_STORAGE_KEY);

    if (!rawCart) {
        return [];
    }

    try {
        return JSON.parse(rawCart) as CartItem[];
    } catch {
        return [];
    }
}

export function saveCart(items: CartItem[]) {
    if (typeof window === "undefined") {
        return;
    }

    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
}

export function addToCart(newItem: CartItem) {
    const currentCart = getCart();

    const existingItem = currentCart.find(
        (item) => item.ticketTypeId === newItem.ticketTypeId
    );

    if (existingItem) {
        const updatedCart = currentCart.map((item) =>
            item.ticketTypeId === newItem.ticketTypeId
                ? { ...item, quantity: item.quantity + newItem.quantity }
                : item
        );

        saveCart(updatedCart);
        return updatedCart;
    }

    const updatedCart = [...currentCart, newItem];
    saveCart(updatedCart);
    return updatedCart;
}

export function updateCartItemQuantity(ticketTypeId: string, quantity: number) {
    const currentCart = getCart();

    if (quantity <= 0) {
        const updatedCart = currentCart.filter(
            (item) => item.ticketTypeId !== ticketTypeId
        );

        saveCart(updatedCart);
        return updatedCart;
    }

    const updatedCart = currentCart.map((item) =>
        item.ticketTypeId === ticketTypeId ? { ...item, quantity } : item
    );

    saveCart(updatedCart);
    return updatedCart;
}

export function removeCartItem(ticketTypeId: string) {
    const currentCart = getCart();

    const updatedCart = currentCart.filter(
        (item) => item.ticketTypeId !== ticketTypeId
    );

    saveCart(updatedCart);
    return updatedCart;
}

export function clearCart() {
    saveCart([]);
}

export function getCartTotalCents(items: CartItem[]) {
    return items.reduce(
        (total, item) => total + item.unitPriceCents * item.quantity,
        0
    );
}

export function formatPrice(priceCents: number, currency: string) {
    return new Intl.NumberFormat("en-NZ", {
        style: "currency",
        currency: currency.toUpperCase(),
    }).format(priceCents / 100);
}