import type { Promotion, PromotionKind } from "./types";

// Loose shape so raw DB rows (whose `kind` is a plain string) pass without
// casting — the helpers only read timing + discount.
type PromoTiming = Pick<Promotion, "active" | "starts_at" | "ends_at" | "discount_pct">;

// A promotion is "live" when it's active and today falls within its date
// window. Bounds are inclusive: starts_at counts from the start of that day,
// ends_at through the end of that day. Null bound = open-ended on that side.
export function isPromoLive(p: PromoTiming | null | undefined, now: number = Date.now()): boolean {
  if (!p || !p.active) return false;
  if (p.starts_at && now < Date.parse(`${p.starts_at}T00:00:00`)) return false;
  if (p.ends_at && now > Date.parse(`${p.ends_at}T23:59:59`)) return false;
  return true;
}

// The fraction of the price a customer pays under this promotion (1 = no
// change). Only live promotions with a positive discount move the price.
export function promoFactor(p: PromoTiming | null | undefined, now?: number): number {
  if (!isPromoLive(p, now) || !p!.discount_pct) return 1;
  return Math.max(0, 1 - p!.discount_pct / 100);
}

// Apply a promotion to a base price, rounded to cents.
export function applyPromo(base: number, p: PromoTiming | null | undefined, now?: number): number {
  return Math.round(base * promoFactor(p, now) * 100) / 100;
}

export const KIND_LABEL: Record<PromotionKind, string> = {
  limited: "Limited Offer",
  seasonal: "Seasonal Offer",
  special: "Special Offer",
};
