import { createServerFn } from "@tanstack/react-start";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { promo_codes } from "@/db/schema";
import { promoCodeDiscount } from "@/lib/promo-code";
import { requireManager } from "./_auth";

type PromoCodeInput = {
  code: string;
  type: string;
  value: number;
  active: boolean;
};

const normalize = (code: string) => code.trim().toUpperCase();

export const listPromoCodes = createServerFn({ method: "GET" }).handler(async () => {
  await requireManager();
  return getDb().select().from(promo_codes).orderBy(asc(promo_codes.created_at));
});

export const createPromoCode = createServerFn({ method: "POST" })
  .inputValidator((d: PromoCodeInput) => d)
  .handler(async ({ data }) => {
    await requireManager();
    const code = normalize(data.code);
    if (!code) throw new Error("Code is required");
    const [existing] = await getDb().select().from(promo_codes).where(eq(promo_codes.code, code));
    if (existing) throw new Error("That code already exists");
    await getDb()
      .insert(promo_codes)
      .values({ code, type: data.type, value: data.value, active: data.active });
    return { ok: true };
  });

export const updatePromoCode = createServerFn({ method: "POST" })
  .inputValidator((d: PromoCodeInput & { id: string }) => d)
  .handler(async ({ data }) => {
    await requireManager();
    const code = normalize(data.code);
    if (!code) throw new Error("Code is required");
    await getDb()
      .update(promo_codes)
      .set({ code, type: data.type, value: data.value, active: data.active })
      .where(eq(promo_codes.id, data.id));
    return { ok: true };
  });

export const deletePromoCode = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    await requireManager();
    await getDb().delete(promo_codes).where(eq(promo_codes.id, data.id));
    return { ok: true };
  });

// Public: check a code against a subtotal so checkout can preview the discount.
// The order total is still recomputed authoritatively in createOrder.
export const validatePromoCode = createServerFn({ method: "GET" })
  .inputValidator((d: { code: string; subtotal: number }) => d)
  .handler(async ({ data }) => {
    const code = normalize(data.code);
    if (!code) return { valid: false as const, message: "Enter a code." };
    const [row] = await getDb().select().from(promo_codes).where(eq(promo_codes.code, code));
    if (!row || !row.active) return { valid: false as const, message: "Invalid or inactive code." };
    const discount = promoCodeDiscount(row.type, row.value, data.subtotal);
    return { valid: true as const, code: row.code, type: row.type, value: row.value, discount };
  });
