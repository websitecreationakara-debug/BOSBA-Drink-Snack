import { createServerFn } from "@tanstack/react-start";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { hero_slides } from "@/db/schema";
import { requireAdmin } from "./_auth";

type SlideInput = {
  eyebrow: string | null;
  title_top: string | null;
  title_accent: string | null;
  title_bottom: string | null;
  body: string | null;
  image_url: string | null;
  cta_label: string | null;
  cta_link: string;
  sort_order: number;
  active: boolean;
};

export const listHeroSlides = createServerFn({ method: "GET" })
  .inputValidator((d: { all?: boolean } | undefined) => d ?? {})
  .handler(async ({ data }) => {
    const db = getDb();
    const rows = await db
      .select()
      .from(hero_slides)
      .orderBy(asc(hero_slides.sort_order), asc(hero_slides.created_at));
    return data.all ? rows : rows.filter((s) => s.active);
  });

export const createHeroSlide = createServerFn({ method: "POST" })
  .inputValidator((d: SlideInput) => d)
  .handler(async ({ data }) => {
    await requireAdmin();
    await getDb().insert(hero_slides).values(data);
    return { ok: true };
  });

export const updateHeroSlide = createServerFn({ method: "POST" })
  .inputValidator((d: SlideInput & { id: string }) => d)
  .handler(async ({ data }) => {
    await requireAdmin();
    const { id, ...rest } = data;
    await getDb().update(hero_slides).set(rest).where(eq(hero_slides.id, id));
    return { ok: true };
  });

export const deleteHeroSlide = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    await requireAdmin();
    await getDb().delete(hero_slides).where(eq(hero_slides.id, data.id));
    return { ok: true };
  });
