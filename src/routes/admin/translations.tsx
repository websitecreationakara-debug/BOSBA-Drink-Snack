import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getTranslationOverrides,
  saveTranslations,
  type TranslationOverrides,
} from "@/data/translations";
import {
  BUILTIN_DICTS,
  EN_DEFAULTS,
  I18N_SECTIONS,
  LOCALES,
  notifyTranslationsChanged,
} from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Check, Loader2, RotateCcw, Search } from "lucide-react";

export const Route = createFileRoute("/admin/translations")({ component: TranslationsAdmin });

type LocaleCode = (typeof LOCALES)[number]["code"];

const ALL_KEYS = Object.keys(EN_DEFAULTS).filter((k) => k !== "lang.name");

const SECTION_FOR = (key: string) =>
  I18N_SECTIONS.find((s) => key === s.prefix || key.startsWith(s.prefix + "."))?.label ?? "Other";

// Plain-English name for each string, shown above the fields so an editor knows
// what they're changing without decoding the dotted key. Keys not listed here
// just show the raw key.
const KEY_LABELS: Record<string, string> = {
  "bar.storeLocator": "Top bar — “Store Locator” link",
  "bar.delivery": "Top bar — chilled delivery message",
  "bar.needHelp": "Top bar — “Need help?” text",
  "bar.freeDelivery": "Top bar — free delivery message",
  "theme.light": "Theme switch — “Light”",
  "theme.dark": "Theme switch — “Dark”",
  "nav.allCategories": "Menu — “All Categories”",
  "nav.shopBy": "Menu — “Shop By”",
  "nav.browse": "Menu — “Browse”",
  "nav.allProducts": "Menu — “All Products”",
  "nav.searchPlaceholder": "Search box placeholder",
  "nav.wishlist": "Menu — “Wishlist”",
  "nav.signIn": "Menu — “Sign in”",
  "nav.adminDashboard": "Account menu — “Admin Dashboard”",
  "nav.myOrders": "Account menu — “My Orders”",
  "nav.myAddresses": "Account menu — “My Addresses”",
  "nav.account": "Account menu — “Account”",
  "nav.signOut": "Account menu — “Sign out”",
  "nav.cart": "Menu — “Cart”",
  "nav.offers": "Menu — “Offers”",
  "nav.sisterSiteHint": "Menu — sister site hint (seafood)",
  "nav.sisterSiteHintSora": "Menu — sister site hint (sake)",
  "home.premiumSelection": "Homepage — “Our Premium Selection” eyebrow",
  "home.finestProducts": "Homepage — featured products heading",
  "home.trending": "Homepage — trending products heading",
  "home.viewAll": "Homepage — “View all” link",
  "home.newArrivals": "Homepage — new arrivals heading",
  "home.categories": "Homepage — “Shop by Category” heading",
  "home.categoriesSub": "Homepage — “Shop by Category” subtitle",
  "home.shop": "Homepage — category card “Shop” button",
  "home.editorial.uniqueEyebrow": "Homepage editorial — unique eyebrow",
  "home.editorial.uniqueTitle": "Homepage editorial — unique title",
  "home.editorial.uniqueCta": "Homepage editorial — unique button",
  "home.editorial.newEyebrow": "Homepage editorial — “New this month” eyebrow",
  "home.editorial.newTitle": "Homepage editorial — “New this month” title",
  "home.editorial.newCta": "Homepage editorial — “New this month” button",
  "home.drinks.eyebrow": "Homepage drinks band — eyebrow",
  "home.drinks.title": "Homepage drinks band — title",
  "home.drinks.statBrands": "Homepage drinks band — stat: products",
  "home.drinks.statOrders": "Homepage drinks band — stat: orders",
  "home.drinks.statRating": "Homepage drinks band — stat: rating",
  "home.drinks.cta": "Homepage drinks band — button",
  "feature.delivery.title": "Feature: Fast Delivery — title",
  "feature.delivery.body": "Feature: Fast Delivery — text",
  "feature.sashimi.title": "Feature: Imported from Japan — title",
  "feature.sashimi.body": "Feature: Imported from Japan — text",
  "feature.quality.title": "Feature: Quality Promise — title",
  "feature.quality.body": "Feature: Quality Promise — text",
  "feature.cold.title": "Feature: Carefully Packed — title",
  "feature.cold.body": "Feature: Carefully Packed — text",
  "cta.member": "Membership banner — eyebrow",
  "cta.title": "Membership banner — title",
  "cta.body": "Membership banner — body text",
  "cta.join": "Membership banner — button",
  "cart.title": "Cart — heading",
  "cart.empty": "Cart — empty message",
  "cart.emptySub": "Cart — empty subtitle",
  "cart.returnToShop": "Cart — “Return to Shop” button",
  "cart.freeDeliveryHint": "Cart — free delivery progress hint",
  "cart.freeDeliveryUnlocked": "Cart — free delivery unlocked message",
  "cart.each": "Cart — “{price} each”",
  "cart.subtotal": "Cart — “Subtotal” label",
  "cart.checkout": "Cart — checkout button",
  "product.addToCart": "Product — “Add to cart” button",
  "product.noImage": "Product — “No image” placeholder",
  "product.from": "Product — “from” price prefix",
  "product.selectOptions": "Product — “Select options” button",
  "product.freeDelivery": "Product — free delivery note",
  "product.youMightAlsoLike": "Product — related products heading",
  "shop.title": "Shop — page title",
  "shop.count": "Shop — product count (“{n} products”)",
  "shop.filters": "Shop — “Filters” heading",
  "shop.clearAll": "Shop — “Clear all” button",
  "shop.categories": "Shop — “Categories” heading",
  "shop.allProducts": "Shop — “All Products” option",
  "shop.price": "Shop — “Price” filter label",
  "shop.offers": "Shop — “Offers” filter label",
  "shop.onSaleOnly": "Shop — “On sale only” toggle",
  "shop.sort": "Shop — “Sort” label",
  "shop.sort.featured": "Shop — sort: Featured",
  "shop.sort.priceAsc": "Shop — sort: Price low to high",
  "shop.sort.priceDesc": "Shop — sort: Price high to low",
  "shop.sort.rating": "Shop — sort: Top Rated",
  "shop.noProducts": "Shop — “No products found”",
  "shop.noProductsSub": "Shop — no products subtitle",
  "shop.clearFilters": "Shop — “Clear filters” button",
  "offers.title": "Offers — page title",
  "offers.subtitle": "Offers — subtitle",
  "offers.empty": "Offers — empty message",
  "offers.viewAll": "Offers — “View all offers” link",
  "offers.ends": "Offers — “Ends {date}” label",
  "offer.kind.limited": "Offer badge — “Limited Offer”",
  "offer.kind.seasonal": "Offer badge — “Seasonal Offer”",
  "offer.kind.special": "Offer badge — “Special Offer”",
  "footer.tagline": "Footer — tagline",
  "footer.marketplace": "Footer — “Marketplace” heading",
  "footer.sashimiFillets": "Footer — link: Beer & Sake",
  "footer.shellfish": "Footer — link: Snacks & Sweets",
  "footer.roeUni": "Footer — link: Pantry & Seasonings",
  "footer.alsoVisit": "Footer — “Also Visit” heading",
  "footer.followTitle": "Footer — “Follow Us” heading",
  "footer.followSub": "Footer — “Follow Us” subtitle",
  "footer.privacy": "Footer — “Privacy” link",
  "footer.terms": "Footer — “Terms” link",
  "footer.sitemap": "Footer — “Sitemap” link",
};

// Sections that actually have strings, in display order.
const SECTIONS: { label: string; short: string }[] = (() => {
  const out = I18N_SECTIONS.map((s) => ({ label: s.label, short: s.short })).filter((s) =>
    ALL_KEYS.some((k) => SECTION_FOR(k) === s.label),
  );
  if (ALL_KEYS.some((k) => SECTION_FOR(k) === "Other"))
    out.push({ label: "Other", short: "Other" });
  return out;
})();

const KEYS_BY_SECTION: Record<string, string[]> = Object.fromEntries(
  SECTIONS.map((s) => [s.label, ALL_KEYS.filter((k) => SECTION_FOR(k) === s.label)]),
);

// Effective built-in value for a locale, falling back to the English default.
const builtin = (locale: LocaleCode, key: string) =>
  BUILTIN_DICTS[locale]?.[key] ?? EN_DEFAULTS[key] ?? "";

type Draft = Record<string, Partial<Record<LocaleCode, string>>>;
type Mode = "all" | "edited" | "km" | "ja";

const MODES: { key: Mode; label: string }[] = [
  { key: "all", label: "All" },
  { key: "edited", label: "Edited" },
  { key: "km", label: "Needs ខ្មែរ" },
  { key: "ja", label: "Needs 日本語" },
];

function TranslationsAdmin() {
  const qc = useQueryClient();
  const { data: overrides, isLoading } = useQuery<TranslationOverrides>({
    queryKey: ["translations"],
    queryFn: () => getTranslationOverrides(),
  });

  // Only edited fields live here; everything else renders from overrides/builtin.
  const [draft, setDraft] = useState<Draft>({});
  const [query, setQuery] = useState("");
  const [section, setSection] = useState<string>(SECTIONS[0].label);
  const [mode, setMode] = useState<Mode>("all");
  const [saving, setSaving] = useState(false);

  const searching = query.trim() !== "";

  // Current value shown in a field: unsaved edit → saved override → built-in.
  const valueOf = (locale: LocaleCode, key: string) =>
    draft[key]?.[locale] ?? overrides?.[locale]?.[key] ?? builtin(locale, key);

  const setValue = (locale: LocaleCode, key: string, v: string) =>
    setDraft((d) => ({ ...d, [key]: { ...d[key], [locale]: v } }));

  const keyEdited = (key: string) =>
    LOCALES.some((l) => valueOf(l.code, key).trim() !== builtin(l.code, key).trim());

  // "Needs translation" = blank, or still identical to the English wording.
  const untranslated = (locale: LocaleCode, key: string) => {
    const v = valueOf(locale, key).trim();
    return v === "" || v === valueOf("en", key).trim();
  };
  const keyNeedsWork = (key: string) => untranslated("km", key) || untranslated("ja", key);

  const dirtyEntries = useMemo(() => {
    const out: { locale: string; key: string; value: string }[] = [];
    for (const [key, byLocale] of Object.entries(draft)) {
      for (const [locale, v] of Object.entries(byLocale)) {
        const saved = overrides?.[locale as LocaleCode]?.[key] ?? "";
        // Sending the built-in default clears the override server-side.
        const normalized = v.trim() === builtin(locale as LocaleCode, key).trim() ? "" : v;
        if (normalized.trim() !== saved.trim()) out.push({ locale, key, value: normalized });
      }
    }
    return out;
  }, [draft, overrides]);

  // Per-section counters for the rail (recomputed as the editor types / saves).
  const stats = useMemo(() => {
    const m: Record<string, { total: number; needs: number }> = {};
    for (const s of SECTIONS) {
      const keys = KEYS_BY_SECTION[s.label];
      m[s.label] = { total: keys.length, needs: keys.filter(keyNeedsWork).length };
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, overrides]);

  const visibleKeys = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = searching
      ? ALL_KEYS.filter(
          (k) =>
            k.toLowerCase().includes(q) ||
            (KEY_LABELS[k] ?? "").toLowerCase().includes(q) ||
            LOCALES.some((l) => valueOf(l.code, k).toLowerCase().includes(q)),
        )
      : KEYS_BY_SECTION[section];
    return base.filter((k) => {
      if (mode === "edited") return keyEdited(k);
      if (mode === "km") return untranslated("km", k);
      if (mode === "ja") return untranslated("ja", k);
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, searching, section, mode, draft, overrides]);

  const save = async () => {
    if (dirtyEntries.length === 0) return;
    setSaving(true);
    try {
      await saveTranslations({ data: { entries: dirtyEntries } });
      await qc.invalidateQueries({ queryKey: ["translations"] });
      notifyTranslationsChanged();
      setDraft({});
      toast.success(
        `Saved ${dirtyEntries.length} translation${dirtyEntries.length === 1 ? "" : "s"}`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save translations");
    } finally {
      setSaving(false);
    }
  };

  const headingCount = visibleKeys.length;
  const needWorkInView = visibleKeys.filter(keyNeedsWork).length;

  return (
    <div className="pb-24">
      <header className="mb-6">
        <h1 className="font-display font-bold text-3xl">Translations</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Storefront wording in English, ខ្មែរ and 日本語. Blank or unchanged fields fall back to
          the built-in text. Keep tags like{" "}
          <code className="bg-muted px-1 rounded text-xs">{"{threshold}"}</code> and{" "}
          <code className="bg-muted px-1 rounded text-xs">{"{n}"}</code> as they are.
        </p>
      </header>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="space-y-4">
          {/* ── Toolbar: search + one-line section tabs ─────────────────── */}
          <div className="space-y-2.5">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (e.target.value.trim()) setMode("all");
                }}
                placeholder="Search all text…"
                className="pl-9"
              />
            </div>

            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
              {SECTIONS.map((s) => {
                const active = !searching && section === s.label;
                const st = stats[s.label];
                return (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setSection(s.label);
                    }}
                    className={cn(
                      "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                      active
                        ? "border-brand bg-brand text-brand-foreground"
                        : "bg-card text-foreground/70 hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {s.short}
                    {st.needs > 0 ? (
                      <span
                        className={cn(
                          "rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
                          active
                            ? "bg-brand-foreground/20"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
                        )}
                        title={`${st.needs} still need ខ្មែរ or 日本語`}
                      >
                        {st.needs}
                      </span>
                    ) : (
                      <Check
                        className={cn(
                          "size-3.5",
                          active
                            ? "text-brand-foreground/80"
                            : "text-emerald-600 dark:text-emerald-400",
                        )}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Detail header ─────────────────────────────────────────── */}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display font-bold text-xl">
                {searching ? `Results for “${query.trim()}”` : section}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {headingCount} {headingCount === 1 ? "string" : "strings"}
                {needWorkInView > 0 && ` · ${needWorkInView} need work`}
              </p>
            </div>
            <div className="flex rounded-lg border bg-card p-1">
              {MODES.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setMode(m.key)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    mode === m.key
                      ? "bg-brand text-brand-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {visibleKeys.length === 0 ? (
              <div className="rounded-xl border border-dashed bg-card px-5 py-12 text-center text-sm text-muted-foreground">
                {mode === "km"
                  ? "Every string here has ខ្មែរ text. 🎉"
                  : mode === "ja"
                    ? "Every string here has 日本語 text. 🎉"
                    : mode === "edited"
                      ? "Nothing edited here yet."
                      : `No strings match “${query.trim()}”.`}
              </div>
            ) : (
              visibleKeys.map((key) => (
                <article key={key} className="rounded-xl border bg-card p-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-tight">
                        {KEY_LABELS[key] ?? key}
                      </p>
                      {searching && (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {SECTION_FOR(key)}
                        </p>
                      )}
                    </div>
                    <code className="shrink-0 text-[10px] text-muted-foreground/70">{key}</code>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    {LOCALES.map((l) => {
                      const changed = valueOf(l.code, key) !== builtin(l.code, key);
                      const needs = l.code !== "en" && untranslated(l.code, key);
                      return (
                        <div key={l.code}>
                          <div className="mb-1 flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                              {l.label}
                              {needs && (
                                <span
                                  className="size-1.5 rounded-full bg-amber-500"
                                  title="Still using the English wording"
                                />
                              )}
                            </span>
                            {changed && (
                              <button
                                type="button"
                                onClick={() => setValue(l.code, key, builtin(l.code, key))}
                                title="Reset to built-in default"
                                className="text-muted-foreground hover:text-foreground"
                              >
                                <RotateCcw className="size-3" />
                              </button>
                            )}
                          </div>
                          <Textarea
                            value={valueOf(l.code, key)}
                            onChange={(e) => setValue(l.code, key, e.target.value)}
                            rows={2}
                            dir="ltr"
                            className={cn(
                              "min-h-[2.5rem] resize-y text-sm",
                              changed && "border-brand/50 bg-brand/[0.03]",
                            )}
                          />
                        </div>
                      );
                    })}
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      )}

      {dirtyEntries.length > 0 && (
        <div className="fixed bottom-4 right-4 z-20 flex items-center gap-3 rounded-full border bg-background/95 py-2 pl-5 pr-2 shadow-lg backdrop-blur">
          <span className="text-sm text-muted-foreground">
            {dirtyEntries.length} unsaved change{dirtyEntries.length === 1 ? "" : "s"}
          </span>
          <Button variant="ghost" size="sm" onClick={() => setDraft({})} disabled={saving}>
            Discard
          </Button>
          <Button size="sm" className="rounded-full" onClick={save} disabled={saving}>
            {saving && <Loader2 className="size-4 mr-1.5 animate-spin" />}
            Save changes
          </Button>
        </div>
      )}
    </div>
  );
}
