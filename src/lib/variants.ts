import type { Product, ProductVariation } from "./types";

export const variationPrice = (v: ProductVariation) => v.sale_price ?? v.price;

export const simplePrice = (p: Product) => p.sale_price ?? p.price;

// Lowest effective price a product sells at: cheapest variation for a variable
// product, otherwise its own price.
export const productFromPrice = (p: Product, variations: ProductVariation[]) => {
  if (p.type === "variable" && variations.length)
    return Math.min(...variations.map(variationPrice));
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
