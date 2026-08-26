import type { Product, ProductVariation } from "./types";

export const variationPrice = (v: ProductVariation) => v.sale_price ?? v.price;

// A variation only has a real price once an admin fills in "Sale Price" — the
// admin form never writes the legacy `price` column, so 0 there just means
// unset. Treat that as "no price yet", not a genuine free/zero price.
export const hasValidPrice = (v: ProductVariation) => variationPrice(v) > 0;

export const simplePrice = (p: Product) => p.sale_price ?? p.price;

// Lowest effective price a product sells at: cheapest *priced* variation for
// a variable product, otherwise its own price. Unpriced variations (added but
// never given a Sale Price) are excluded so the card doesn't show "from $0".
export const productFromPrice = (p: Product, variations: ProductVariation[]) => {
  const priced = variations.filter(hasValidPrice);
  if (p.type === "variable" && priced.length) return Math.min(...priced.map(variationPrice));
  return simplePrice(p);
};

// Group all variations by product_id for O(1) lookup in lists.
export const groupVariations = (variations: ProductVariation[]) => {
  const map = new Map<string, ProductVariation[]>();
  for (const v of variations) {
    const list = map.get(v.product_id);
    if (list) list.push(v);
    else map.set(v.product_id, [v]);
  }
  return map;
};
