import type { Product, ProductVariation } from "@/types";

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

// ---- Stock groups ----------------------------------------------------------
// Variations of one product don't always draw from one shelf. Two variations
// share a stock count only when they have the same flavor AND (for liquid
// sizes, i.e. ml/L) the same size — "Lemon 6 cans" + "Lemon 12 cans" are one
// pool, but Lemon vs Muscat, or a 1.8L vs a 720ml bottle, each count apart.
// Every variation row stores its group's count, kept equal across the group;
// migration 0047 mirrors this key in SQL, so change both together.
type StockVariation = Pick<ProductVariation, "flavor" | "weight">;

const isVolume = (weight: string) =>
  /\d(ml|cl|l|lt|ltr|liter|litre)$/i.test(weight.replace(/\s+/g, ""));

export const stockGroupKey = (v: StockVariation) => {
  const size = v.weight.replace(/\s+/g, "").toLowerCase();
  return `${(v.flavor ?? "").trim().toLowerCase()}|${isVolume(v.weight) ? size : ""}`;
};

export const stockGroupLabel = (v: StockVariation) => {
  const flavor = (v.flavor ?? "").trim();
  const size = isVolume(v.weight) ? v.weight.trim() : "";
  return [flavor, size].filter(Boolean).join(" · ") || "All variations";
};

// null = untracked (unlimited). A group's count is its first tracked member's.
export const groupStockValue = (members: { stock: number | null }[]) =>
  members.find((m) => m.stock != null)?.stock ?? null;

// Product-level rollup kept on products.stock for variable products so lists,
// cards and feeds can stay product-level: null if any group is untracked, else
// the sum of the groups (0 therefore means every group is out).
export const stockRollup = (variations: (StockVariation & { stock: number | null })[]) => {
  const groups = new Map<string, { stock: number | null }[]>();
  for (const v of variations) {
    const key = stockGroupKey(v);
    const list = groups.get(key);
    if (list) list.push(v);
    else groups.set(key, [v]);
  }
  if (groups.size === 0) return null;
  let total = 0;
  for (const members of groups.values()) {
    const s = groupStockValue(members);
    if (s == null) return null;
    total += s;
  }
  return total;
};
