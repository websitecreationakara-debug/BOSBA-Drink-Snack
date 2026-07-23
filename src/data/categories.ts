import { createServerFn } from "@tanstack/react-start";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { categories } from "@/db/schema";
import { requireManager } from "./_auth";

export const listCategories = createServerFn({ method: "GET" }).handler(async () => {
  return getDb().select().from(categories).orderBy(asc(categories.created_at));
});

export const createCategory = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { name: string; slug: string; image_url?: string | null; parent_id?: string | null }) => d,
  )
  .handler(async ({ data }) => {
    await requireManager();
    await getDb().insert(categories).values(data);
    return { ok: true };
  });

export const updateCategory = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      id: string;
      image_url?: string | null;
      name?: string;
      slug?: string;
      parent_id?: string | null;
    }) => d,
  )
  .handler(async ({ data }) => {
    await requireManager();
    const { id, ...fields } = data;
    const set = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
    if (Object.keys(set).length === 0) return { ok: true };
    await getDb().update(categories).set(set).where(eq(categories.id, id));
    return { ok: true };
  });

export const deleteCategory = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    await requireManager();
    const db = getDb();
    // Detach any children so they don't dangle, then delete the category.
    await db.update(categories).set({ parent_id: null }).where(eq(categories.parent_id, data.id));
    await db.delete(categories).where(eq(categories.id, data.id));
    return { ok: true };
  });
