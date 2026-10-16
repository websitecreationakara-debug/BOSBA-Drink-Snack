import type { Product } from "@/types";

// Shared between the product page's <head> tags/Pixel ViewContent call
// (routes/_store/product.$id.tsx) and the scheduled product feed
// (start.ts's productFeedMiddleware) — both must describe the same product
// the same way so Commerce Manager doesn't see mismatched data.
// Mirrors BOSBA Premium Foods' lib/meta-catalog.ts.

export const metaDescription = (p: Product) =>
  (p.description?.trim() || `${p.title} — from BOSBA Drink&Snack.`)
    .replace(/\s+/g, " ")
    .slice(0, 160);

// Meta Catalog's product:availability tag/feed column wants a plain string,
// not the schema.org URL ProductJsonLd uses.
export const metaAvailability = (p: Product): string =>
  p.pre_order ? "preorder" : p.stock === 0 ? "out of stock" : "in stock";

// SKU Meta Catalog matches on (product:retailer_item_id / Pixel
// content_ids / feed id) — product_code when set, else the row id so it's
// always unique even for products created before product_code existed.
export const metaRetailerId = (p: Product): string => p.product_code ?? p.id;
