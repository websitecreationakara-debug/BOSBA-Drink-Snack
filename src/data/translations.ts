import { createServerFn } from "@tanstack/react-start";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { translations } from "@/db/schema";
import { requireAdmin } from "./_auth";

const LOCALES = ["en", "km", "ja"] as const;
type Locale = (typeof LOCALES)[number];

export type TranslationOverrides = Record<Locale, Record<string, string>>;

// Public: every admin override, shaped as { en: { key: value }, km: {…}, ja: {…} }
// so src/lib/i18n.tsx can merge them straight over the built-in defaults.
export const getTranslationOverrides = createServerFn({ method: "GET" }).handler(async () => {
  const rows = await getDb().select().from(translations);
  const out: TranslationOverrides = { en: {}, km: {}, ja: {} };
  for (const r of rows) {
    if ((LOCALES as readonly string[]).includes(r.locale)) {
      out[r.locale as Locale][r.key] = r.value;
    }
  }
  return out;
});

// Sentinel "locale" for rows that just mark an i18n key as intentionally the
// same in every language (a brand name, a symbol, "{n}") so the admin editor
// stops flagging it as needing a translation. Ignored by the storefront merge
// above and by saveTranslations (both filter to real locales).
const ACCEPT_LOCALE = "_accept";

// Admin: keys the editor has marked "single language is fine".
export const getAcceptedKeys = createServerFn({ method: "GET" }).handler(async () => {
  const rows = await getDb().select().from(translations);
  return rows.filter((r) => r.locale === ACCEPT_LOCALE).map((r) => r.key);
});

export const setAcceptedKey = createServerFn({ method: "POST" })
  .inputValidator((d: { key: string; accepted: boolean }) => d)
  .handler(async ({ data }) => {
    await requireAdmin();
    const db = getDb();
    if (!data.key) return { ok: false };
    if (data.accepted) {
      await db
        .insert(translations)
        .values({
          locale: ACCEPT_LOCALE,
          key: data.key,
          value: "1",
          updated_at: new Date().toISOString(),
        })
        .onConflictDoNothing();
    } else {
      await db
        .delete(translations)
        .where(and(eq(translations.locale, ACCEPT_LOCALE), eq(translations.key, data.key)));
    }
    return { ok: true };
  });

type Entry = { locale: string; key: string; value: string };

// Admin-only: upsert a batch of overrides. A blank value removes the override
// (the storefront falls back to the built-in default for that string).
export const saveTranslations = createServerFn({ method: "POST" })
  .inputValidator((d: { entries: Entry[] }) => d)
  .handler(async ({ data }) => {
    await requireAdmin();
    const db = getDb();
    const now = new Date().toISOString();
    for (const e of data.entries) {
      if (!(LOCALES as readonly string[]).includes(e.locale) || !e.key) continue;
      const value = e.value.trim();
      if (!value) {
        await db
          .delete(translations)
          .where(and(eq(translations.locale, e.locale), eq(translations.key, e.key)));
        continue;
      }
      await db
        .insert(translations)
        .values({ locale: e.locale, key: e.key, value, updated_at: now })
        .onConflictDoUpdate({
          target: [translations.locale, translations.key],
          set: { value, updated_at: now },
        });
    }
    return { ok: true, count: data.entries.length };
  });
