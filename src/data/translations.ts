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

// Sentinel "locale" prefix for rows that mark one i18n key + one language as
// intentionally left the same as English (a brand name, "{n}", a symbol), so the
// admin editor stops flagging just that field. Per language: "_accept_km" /
// "_accept_ja". Ignored by the storefront merge above and by saveTranslations
// (both filter to real locales).
const ACCEPT_PREFIX = "_accept_";
type AcceptLocale = "km" | "ja";

// Admin: which keys have been accepted as "same as English" per language.
export const getAcceptedKeys = createServerFn({ method: "GET" }).handler(async () => {
  const rows = await getDb().select().from(translations);
  const out: Record<AcceptLocale, string[]> = { km: [], ja: [] };
  for (const r of rows) {
    if (r.locale === ACCEPT_PREFIX + "km") out.km.push(r.key);
    else if (r.locale === ACCEPT_PREFIX + "ja") out.ja.push(r.key);
  }
  return out;
});

export const setAcceptedKey = createServerFn({ method: "POST" })
  .inputValidator((d: { key: string; locale: AcceptLocale; accepted: boolean }) => d)
  .handler(async ({ data }) => {
    await requireAdmin();
    const db = getDb();
    if (!data.key || (data.locale !== "km" && data.locale !== "ja")) return { ok: false };
    const sentinel = ACCEPT_PREFIX + data.locale;
    if (data.accepted) {
      await db
        .insert(translations)
        .values({
          locale: sentinel,
          key: data.key,
          value: "1",
          updated_at: new Date().toISOString(),
        })
        .onConflictDoNothing();
    } else {
      await db
        .delete(translations)
        .where(and(eq(translations.locale, sentinel), eq(translations.key, data.key)));
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
