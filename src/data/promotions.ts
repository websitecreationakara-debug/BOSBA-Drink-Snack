import { createServerFn } from "@tanstack/react-start";
import { asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { promotions, products } from "@/db/schema";
import { isPromoLive } from "@/lib/promotions";
import { requireManager } from "./_auth";

type PromotionInput = {
  name: string;
  kind: string;
  description: string | null;
  discount_pct: number | null;
  starts_at: string | null;
  ends_at: string | null;
  active: boolean;
  sort_order: number;
};

export const listPromotions = createServerFn({ method: "GET" })
  .inputValidator((d: { all?: boolean } | undefined) => d ?? {})
  .handler(async ({ data }) => {
    const rows = await getDb()
      .select()
      .from(promotions)
      .orderBy(asc(promotions.sort_order), asc(promotions.created_at));
    // Public callers only ever see promotions that are currently running.
    return data.all ? rows : rows.filter((p) => isPromoLive(p));
  });

export const createPromotion = createServerFn({ method: "POST" })
  .inputValidator((d: PromotionInput) => d)
  .handler(async ({ data }) => {
    await requireManager();
    const [row] = await getDb().insert(promotions).values(data).returning({ id: promotions.id });
    return { id: row.id };
  });

export const updatePromotion = createServerFn({ method: "POST" })
  .inputValidator((d: PromotionInput & { id: string }) => d)
  .handler(async ({ data }) => {
    await requireManager();
    const { id, ...rest } = data;
    await getDb().update(promotions).set(rest).where(eq(promotions.id, id));
    return { ok: true };
  });

export const deletePromotion = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    await requireManager();
    // FK is ON DELETE SET NULL, so assigned products simply lose their offer.
    await getDb().delete(promotions).where(eq(promotions.id, data.id));
    return { ok: true };
  });

// Bulk-assign (or clear, with promotionId = null) the offer on a set of
// products — used by the Marketing page to add/remove products from an offer.
export const assignPromotion = createServerFn({ method: "POST" })
  .inputValidator((d: { productIds: string[]; promotionId: string | null }) => d)
  .handler(async ({ data }) => {
    await requireManager();
    if (data.productIds.length === 0) return { ok: true };
    await getDb()
      .update(products)
      .set({ promotion_id: data.promotionId })
      .where(inArray(products.id, data.productIds));
    return { ok: true };
  });
