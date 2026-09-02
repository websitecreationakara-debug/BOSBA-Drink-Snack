// Dollar discount a promo code takes off a subtotal. Never exceeds the subtotal
// and never goes negative. Shared by the checkout preview and the authoritative
// server-side total in createOrder.
export function promoCodeDiscount(type: string, value: number, subtotal: number): number {
  if (subtotal <= 0 || value <= 0) return 0;
  const raw = type === "fixed" ? value : (subtotal * value) / 100;
  return Math.min(subtotal, Math.round(raw * 100) / 100);
}
