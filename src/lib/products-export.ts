// Client-side product export to .xlsx for the admin products table. xlsx is
// heavy and only needed on click, so it's imported dynamically — same pattern
// as the invoice PDF generator (see ./invoice.ts) — to keep it out of the
// storefront bundle entirely.
import type { Product, Category, Promotion, ProductVariation } from "./types";

function priceRange(vs: ProductVariation[]): string {
  if (!vs.length) return "";
  const prices = vs.map((v) => v.sale_price ?? v.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? min.toFixed(2) : `${min.toFixed(2)}–${max.toFixed(2)}`;
}

function stockTotal(vs: ProductVariation[]): number | string {
  if (!vs.length) return "";
  const tracked = vs.filter((v) => v.stock != null);
  return tracked.length === 0 ? "∞" : tracked.reduce((a, v) => a + (v.stock ?? 0), 0);
}

export async function downloadProductsXlsx(
  products: Product[],
  categories: Category[],
  promotions: Promotion[],
  variationsByProduct: Map<string, ProductVariation[]>,
) {
  const XLSX = await import("xlsx");

  const categoryName = new Map(categories.map((c) => [c.id, c.name]));
  const promotionName = new Map(promotions.map((p) => [p.id, p.name]));

  const productRows = products.map((p) => {
    const variable = p.type === "variable";
    const vs = variationsByProduct.get(p.id) ?? [];
    return {
      ID: p.id,
      Title: p.title,
      Description: p.description ?? "",
      Type: p.type,
      Category: p.category_id ? (categoryName.get(p.category_id) ?? p.category_id) : "",
      Status: p.status,
      Featured: p.featured ? "Yes" : "No",
      "Pre-order": p.pre_order ? "Yes" : "No",
      Badge: p.badge ?? "",
      Rating: p.rating ?? "",
      Price: variable ? priceRange(vs) : p.price.toFixed(2),
      "Sale Price": variable ? "" : (p.sale_price?.toFixed(2) ?? ""),
      Stock: variable ? stockTotal(vs) : (p.stock ?? "∞"),
      Weight: variable ? "" : (p.weight ?? ""),
      "Pcs/box": variable ? "" : (p.pcs ?? ""),
      Variations: variable ? vs.length : "",
      Promotion: p.promotion_id ? (promotionName.get(p.promotion_id) ?? p.promotion_id) : "",
      "Sort Order": p.sort_order,
      "Image URL": p.image_url ?? "",
      "Created At": p.created_at,
      "Updated At": p.updated_at,
    };
  });

  const variationRows = products.flatMap((p) => {
    if (p.type !== "variable") return [];
    return (variationsByProduct.get(p.id) ?? []).map((v) => ({
      "Product ID": p.id,
      "Product Title": p.title,
      Flavor: v.flavor ?? "",
      Weight: v.weight,
      Price: v.price.toFixed(2),
      "Sale Price": v.sale_price?.toFixed(2) ?? "",
      Stock: v.stock ?? "∞",
      "Pcs/box": v.pcs ?? "",
    }));
  });

  const wb = XLSX.utils.book_new();
  const productsSheet = XLSX.utils.json_to_sheet(productRows);
  XLSX.utils.book_append_sheet(wb, productsSheet, "Products");
  if (variationRows.length) {
    const variationsSheet = XLSX.utils.json_to_sheet(variationRows);
    XLSX.utils.book_append_sheet(wb, variationsSheet, "Variations");
  }

  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `BOSBA-Drink-Snack-products-${date}.xlsx`);
}
