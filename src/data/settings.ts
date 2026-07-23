import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { store_settings } from "@/db/schema";
import { requireAdmin } from "./_auth";

export const getSettings = createServerFn({ method: "GET" }).handler(async () => {
  const rows = await getDb().select().from(store_settings).limit(1);
  return rows[0] ?? null;
});

export const updateSettings = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      id: string;
      banner_text: string | null;
      global_discount_pct: number;
      free_shipping_threshold: number;
    }) => d,
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const { id, ...rest } = data;
    await getDb()
      .update(store_settings)
      .set({ ...rest, updated_at: new Date().toISOString() })
      .where(eq(store_settings.id, id));
    return { ok: true };
  });
