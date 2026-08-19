import { createServerFn } from "@tanstack/react-start";
import { eq, asc, desc, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { products, product_variations, product_images, promotions } from "@/db/schema";
import { slugify, isUuid } from "@/lib/utils";
import { applyPromo } from "@/lib/promotions";
import { requireManager } from "./_auth";

type ProductInput = {
  title: string;
  description: string | null;
  price: number;
  sale_price: number | null;
  category_id: string | null;
  stock: number | null;
  status: string;
  image_url: string | null;
  badge: string | null;
  rating: number | null;
  weight: string | null;
  pcs: number | null;
  type: string;
  featured: boolean;
  promotion_id: string | null;
  video_url: string | null;
};

type ProductRow = typeof products.$inferSelect;
type VariationRow = typeof product_variations.$inferSelect;

// Lower a product's sale_price to reflect any live promotion discount, so every
// storefront surface (cards, cart snapshot, product page) shows the offer price
// without each having to know about promotions. Admin reads skip this.
async function applyProductPromos(rows: ProductRow[]): Promise<ProductRow[]> {
  const ids = [...new Set(rows.map((r) => r.promotion_id).filter((id): id is string => !!id))];
  if (ids.length === 0) return rows;
  const promos = await getDb().select().from(promotions).where(inArray(promotions.id, ids));
  const map = new Map(promos.map((p) => [p.id, p]));
  const now = Date.now();
  return rows.map((r) => {
    const promo = r.promotion_id ? map.get(r.promotion_id) : undefined;
    if (!promo) return r;
    const base = r.sale_price ?? r.price;
    const discounted = applyPromo(base, promo, now);
    return discounted < base ? { ...r, sale_price: discounted } : r;
  });
}

// Same idea for variations: the discount lives on the parent product's promotion.
async function applyVariationPromos(rows: VariationRow[]): Promise<VariationRow[]> {
  const productIds = [...new Set(rows.map((v) => v.product_id))];
  if (productIds.length === 0) return rows;
  const parents = await getDb()
    .select({ id: products.id, promotion_id: products.promotion_id })
    .from(products)
    .where(inArray(products.id, productIds));
  const promoIdByProduct = new Map(parents.map((p) => [p.id, p.promotion_id]));
  const promoIds = [
    ...new Set(parents.map((p) => p.promotion_id).filter((id): id is string => !!id)),
  ];
  if (promoIds.length === 0) return rows;
  const promos = await getDb().select().from(promotions).where(inArray(promotions.id, promoIds));
  const map = new Map(promos.map((p) => [p.id, p]));
  const now = Date.now();
  return rows.map((v) => {
    const pid = promoIdByProduct.get(v.product_id);
    const promo = pid ? map.get(pid) : undefined;
    if (!promo) return v;
    const base = v.sale_price ?? v.price;
    const discounted = applyPromo(base, promo, now);
    return discounted < base ? { ...v, sale_price: discounted } : v;
  });
}

type VariationInput = {
  id?: string;
  weight: string;
  price: number;
  sale_price: number | null;
  stock: number | null;
  pcs: number | null;
  sort_order: number;
  image_url: string | null;
};

export const listProducts = createServerFn({ method: "GET" })
  .inputValidator((d: { all?: boolean } | undefined) => d ?? {})
  .handler(async ({ data }) => {
    const db = getDb();
    if (data.all) {
      // Admin view: raw prices, no promotion discount applied.
      return db
        .select()
        .from(products)
        .orderBy(asc(products.sort_order), desc(products.created_at));
    }
    const rows = await db
      .select()
      .from(products)
      .where(eq(products.status, "published"))
      .orderBy(asc(products.sort_order), desc(products.created_at));
    return applyProductPromos(rows);
  });

// `id` may be a real UUID (old links, admin) or a title-derived slug (pretty
// URLs). UUIDs resolve directly; slugs fall back to a scan since there's no
// slug column on products.
export const getProduct = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const db = getDb();
    if (isUuid(data.id)) {
      const [row] = await db.select().from(products).where(eq(products.id, data.id));
      if (row) return (await applyProductPromos([row]))[0];
    }
    const all = await db.select().from(products);
    const match = all.find((p) => slugify(p.title) === data.id);
    return match ? (await applyProductPromos([match]))[0] : null;
  });

// Every variation row across the catalog — small table, fetched once so the
// shop grid can show "from $X" per variable product without N queries.
export const listVariations = createServerFn({ method: "GET" }).handler(async () => {
  const rows = await getDb()
    .select()
    .from(product_variations)
    .orderBy(asc(product_variations.sort_order), asc(product_variations.price));
  return applyVariationPromos(rows);
});

// Variations for a single product, cheapest-first within sort order. `raw`
// skips promotion discounts — the admin editor needs the true stored prices so
// it doesn't save offer-adjusted values back.
export const getVariations = createServerFn({ method: "GET" })
  .inputValidator((d: { productId: string; raw?: boolean }) => d)
  .handler(async ({ data }) => {
    const rows = await getDb()
      .select()
      .from(product_variations)
      .where(eq(product_variations.product_id, data.productId))
      .orderBy(asc(product_variations.sort_order), asc(product_variations.price));
    return data.raw ? rows : applyVariationPromos(rows);
  });

// Replace a product's variations with the supplied set: update existing rows,
// insert new ones, delete any that were removed in the editor.
export const saveVariations = createServerFn({ method: "POST" })
  .inputValidator((d: { productId: string; variations: VariationInput[] }) => d)
  .handler(async ({ data }) => {
    await requireManager();
    const db = getDb();
    const existing = await db
      .select({ id: product_variations.id })
      .from(product_variations)
      .where(eq(product_variations.product_id, data.productId));

    const keepIds = data.variations.map((v) => v.id).filter((id): id is string => !!id);
    const toDelete = existing.filter((e) => !keepIds.includes(e.id)).map((e) => e.id);
    if (toDelete.length)
      await db.delete(product_variations).where(inArray(product_variations.id, toDelete));

    for (const v of data.variations) {
      const fields = {
        weight: v.weight,
        price: v.price,
        sale_price: v.sale_price,
        stock: v.stock,
        pcs: v.pcs,
        sort_order: v.sort_order,
        image_url: v.image_url,
      };
      if (v.id)
        await db.update(product_variations).set(fields).where(eq(product_variations.id, v.id));
      else await db.insert(product_variations).values({ product_id: data.productId, ...fields });
    }
    return { ok: true };
  });

// Gallery photos for one product (the cover image lives on products.image_url).
export const getProductImages = createServerFn({ method: "GET" })
  .inputValidator((d: { productId: string }) => d)
  .handler(async ({ data }) => {
    return getDb()
      .select()
      .from(product_images)
      .where(eq(product_images.product_id, data.productId))
      .orderBy(asc(product_images.sort_order), asc(product_images.created_at));
  });

// Replace a product's gallery with the supplied URLs, in order.
export const saveProductImages = createServerFn({ method: "POST" })
  .inputValidator((d: { productId: string; urls: string[] }) => d)
  .handler(async ({ data }) => {
    await requireManager();
    const db = getDb();
    await db.delete(product_images).where(eq(product_images.product_id, data.productId));
    const urls = data.urls.filter((u) => u.trim() !== "");
    if (urls.length) {
      await db
        .insert(product_images)
        .values(urls.map((url, i) => ({ product_id: data.productId, url, sort_order: i })));
    }
    return { ok: true };
  });

export const createProduct = createServerFn({ method: "POST" })
  .inputValidator((d: ProductInput) => d)
  .handler(async ({ data }) => {
    await requireManager();
    const [row] = await getDb().insert(products).values(data).returning({ id: products.id });
    return { id: row.id };
  });

export const updateProduct = createServerFn({ method: "POST" })
  .inputValidator((d: ProductInput & { id: string }) => d)
  .handler(async ({ data }) => {
    await requireManager();
    const { id, ...rest } = data;
    await getDb()
      .update(products)
      .set({ ...rest, updated_at: new Date().toISOString() })
      .where(eq(products.id, id));
    return { ok: true };
  });

// Quick publish/hide toggle from the admin list — doesn't require the full
// product payload the way updateProduct does.
export const setProductStatus = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; status: string }) => d)
  .handler(async ({ data }) => {
    await requireManager();
    await getDb()
      .update(products)
      .set({ status: data.status, updated_at: new Date().toISOString() })
      .where(eq(products.id, data.id));
    return { ok: true };
  });

// Quick inline stock edit from the admin list — simple products only (variable
// products carry stock per-variation, edited via saveVariations instead).
export const setProductStock = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; stock: number | null }) => d)
  .handler(async ({ data }) => {
    await requireManager();
    await getDb()
      .update(products)
      .set({ stock: data.stock, updated_at: new Date().toISOString() })
      .where(eq(products.id, data.id));
    return { ok: true };
  });

// Persist a new global product order from admin drag-and-drop: sort_order
// becomes each id's position in the array. Ids not passed keep their old value.
export const reorderProducts = createServerFn({ method: "POST" })
  .inputValidator((d: { ids: string[] }) => d)
  .handler(async ({ data }) => {
    await requireManager();
    const db = getDb();
    await Promise.all(
      data.ids.map((id, i) =>
        db.update(products).set({ sort_order: i }).where(eq(products.id, id)),
      ),
    );
    return { ok: true };
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    await requireManager();
    const db = getDb();
    await db.delete(product_variations).where(eq(product_variations.product_id, data.id));
    await db.delete(product_images).where(eq(product_images.product_id, data.id));
    await db.delete(products).where(eq(products.id, data.id));
    return { ok: true };
  });
