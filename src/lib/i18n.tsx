import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getSiteLocale,
  getTranslationOverrides,
  type TranslationOverrides,
} from "@/data/translations";

// Cross-tab signal: the admin Translations page pings this after a save so open
// storefront tabs refetch immediately instead of waiting for a manual refresh.
export const TRANSLATIONS_CHANGED_EVENT = "bosba:translations-changed";

export function notifyTranslationsChanged() {
  // Same tab (storage events don't fire in the tab that wrote them).
  window.dispatchEvent(new Event(TRANSLATIONS_CHANGED_EVENT));
  try {
    localStorage.setItem(TRANSLATIONS_CHANGED_EVENT, String(Date.now()));
  } catch {
    /* private mode / storage disabled — the same-tab refetch still runs */
  }
  if (typeof BroadcastChannel !== "undefined") {
    const ch = new BroadcastChannel(TRANSLATIONS_CHANGED_EVENT);
    ch.postMessage("changed");
    ch.close();
  }
}

export type Locale = "en" | "km" | "ja";

export const LOCALES: { code: Locale; label: string }[] = [
  { code: "en", label: "English" },
  { code: "km", label: "ខ្មែរ" },
  { code: "ja", label: "日本語" },
];

const LOCALE_CODES = LOCALES.map((l) => l.code);
const isLocale = (v: string): v is Locale => (LOCALE_CODES as string[]).includes(v);

// Every storefront string key. Identifiers only — the actual wording lives in the
// `translations` D1 table (seeded by migration 0040_seed_translations) and is
// edited at /admin/translations. This list exists purely so `t("home.trending")`
// stays type-checked; add a key here when you add one to the table.
export const I18N_KEYS = [
  "bar.storeLocator",
  "bar.delivery",
  "bar.needHelp",
  "bar.freeDelivery",
  "theme.light",
  "theme.dark",
  "nav.allCategories",
  "nav.shopBy",
  "nav.browse",
  "nav.allProducts",
  "nav.searchPlaceholder",
  "nav.wishlist",
  "nav.signIn",
  "nav.adminDashboard",
  "nav.myOrders",
  "nav.myAddresses",
  "nav.account",
  "nav.signOut",
  "nav.cart",
  "nav.offers",
  "nav.sisterSiteHint",
  "nav.sisterSiteHintSora",
  "home.premiumSelection",
  "home.finestProducts",
  "home.trending",
  "home.viewAll",
  "home.newArrivals",
  "home.categories",
  "home.categoriesSub",
  "home.shop",
  "home.editorial.uniqueEyebrow",
  "home.editorial.uniqueTitle",
  "home.editorial.uniqueCta",
  "home.editorial.newEyebrow",
  "home.editorial.newTitle",
  "home.editorial.newCta",
  "home.drinks.eyebrow",
  "home.drinks.title",
  "home.drinks.statBrands",
  "home.drinks.statOrders",
  "home.drinks.statRating",
  "home.drinks.cta",
  "feature.delivery.title",
  "feature.delivery.body",
  "feature.sashimi.title",
  "feature.sashimi.body",
  "feature.quality.title",
  "feature.quality.body",
  "feature.cold.title",
  "feature.cold.body",
  "cta.member",
  "cta.title",
  "cta.body",
  "cta.join",
  "cart.title",
  "cart.empty",
  "cart.emptySub",
  "cart.returnToShop",
  "cart.freeDeliveryHint",
  "cart.freeDeliveryUnlocked",
  "cart.each",
  "cart.subtotal",
  "cart.checkout",
  "product.addToCart",
  "product.noImage",
  "product.from",
  "product.selectOptions",
  "product.freeDelivery",
  "product.youMightAlsoLike",
  "shop.title",
  "shop.count",
  "shop.filters",
  "shop.clearAll",
  "shop.categories",
  "shop.allProducts",
  "shop.price",
  "shop.offers",
  "shop.onSaleOnly",
  "shop.sort",
  "shop.sort.featured",
  "shop.sort.priceAsc",
  "shop.sort.priceDesc",
  "shop.sort.rating",
  "shop.noProducts",
  "shop.noProductsSub",
  "shop.clearFilters",
  "offers.title",
  "offers.subtitle",
  "offers.empty",
  "offers.viewAll",
  "offers.ends",
  "offer.kind.limited",
  "offer.kind.seasonal",
  "offer.kind.special",
  "footer.tagline",
  "footer.marketplace",
  "footer.sashimiFillets",
  "footer.shellfish",
  "footer.roeUni",
  "footer.alsoVisit",
  "footer.followTitle",
  "footer.followSub",
  "footer.privacy",
  "footer.terms",
  "footer.sitemap",
] as const;

export type I18nKey = (typeof I18N_KEYS)[number];

// `t()` accepts any string so pages can use keys added at runtime in
// /admin/translations → "Custom" (which aren't in I18N_KEYS). The union keeps
// editor autocomplete for the known keys. An unknown key falls back to English
// then to the raw key, same as a known key with no translation row.
export type I18nKeyLoose = I18nKey | (string & {});

// Ordered sections for the admin Translations editor. The key prefix (before the
// first ".") groups the strings; anything not listed lands in "Other". `short` is
// the label on the section picker buttons; `label` is the group heading.
export const I18N_SECTIONS: { prefix: string; label: string; short: string }[] = [
  { prefix: "home", label: "Homepage", short: "Homepage" },
  { prefix: "feature", label: "Homepage — Feature Highlights", short: "Features" },
  { prefix: "shop", label: "Shop", short: "Shop" },
  { prefix: "product", label: "Product Page", short: "Product Page" },
  { prefix: "offers", label: "Offers", short: "Offers" },
  { prefix: "offer", label: "Offers — Badges", short: "Badges" },
  { prefix: "nav", label: "Navigation & Search", short: "Navigation" },
  { prefix: "bar", label: "Top Announcement Bar", short: "Top Bar" },
  { prefix: "cart", label: "Cart", short: "Cart" },
  { prefix: "theme", label: "Theme Switch", short: "Theme" },
  { prefix: "footer", label: "Footer", short: "Footer" },
];

function interpolate(s: string, vars?: Record<string, string | number>) {
  if (!vars) return s;
  return s.replace(/\$?\{(\w+)\}/g, (_, k: string) =>
    vars[k] != null ? String(vars[k]) : `{${k}}`,
  );
}

// All storefront wording, keyed by locale then i18n key. Comes straight from the
// `translations` table via getTranslationOverrides(); there are no built-in
// dictionaries in code. A missing key falls back to English, then to the raw key.
export type TranslationStrings = TranslationOverrides;
const EMPTY_STRINGS: TranslationStrings = { en: {}, km: {}, ja: {} };

// Fields on a product that can be translated per-locale in /admin/translations.
// Stored in the same `translations` table under the key `product.<id>.<field>`;
// English always comes from the product's own column, so only km/ja rows exist.
export type ProductTextField = "title" | "description" | "badge";

type Ctx = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: I18nKeyLoose, vars?: Record<string, string | number>) => string;
  // Localized product text: the km/ja override when set, otherwise `fallback`
  // (the product's English column). Returns "" only if both are empty.
  tp: (id: string, field: ProductTextField, fallback?: string | null) => string;
};

export const productTextKey = (id: string, field: ProductTextField) => `product.${id}.${field}`;

const I18nContext = createContext<Ctx | null>(null);

export function LanguageProvider({
  children,
  initialStrings,
  initialSiteLocale,
}: {
  children: ReactNode;
  // Seeded from the root route loader so the server-rendered HTML and first
  // client paint are already translated (no flash of raw keys).
  initialStrings?: TranslationStrings;
  initialSiteLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialSiteLocale ?? "en");
  // True once the visitor has picked a language themselves — from then on their
  // choice wins over the admin's store-wide default.
  const [userChose, setUserChose] = useState(false);
  const qc = useQueryClient();

  // Store-wide default language, set by an admin on /admin/translations.
  const { data: siteLocale } = useQuery<Locale>({
    queryKey: ["site-locale"],
    queryFn: () => getSiteLocale(),
    initialData: initialSiteLocale,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  // Every storefront string, from the `translations` table. staleTime 0 + focus
  // refetch so admin edits show up when you switch back to a storefront tab
  // without a hard refresh.
  const { data: strings } = useQuery<TranslationStrings>({
    queryKey: ["translations"],
    queryFn: () => getTranslationOverrides(),
    initialData: initialStrings,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  // Refetch immediately when the admin page reports a save — same tab (custom
  // event / BroadcastChannel) and other tabs (storage event / BroadcastChannel).
  useEffect(() => {
    const refetch = () => {
      qc.invalidateQueries({ queryKey: ["translations"] });
      qc.invalidateQueries({ queryKey: ["site-locale"] });
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === TRANSLATIONS_CHANGED_EVENT) refetch();
    };
    window.addEventListener(TRANSLATIONS_CHANGED_EVENT, refetch);
    window.addEventListener("storage", onStorage);
    let ch: BroadcastChannel | undefined;
    if (typeof BroadcastChannel !== "undefined") {
      ch = new BroadcastChannel(TRANSLATIONS_CHANGED_EVENT);
      ch.onmessage = refetch;
    }
    return () => {
      window.removeEventListener(TRANSLATIONS_CHANGED_EVENT, refetch);
      window.removeEventListener("storage", onStorage);
      ch?.close();
    };
  }, [qc]);

  useEffect(() => {
    const saved = localStorage.getItem("locale");
    if (saved && isLocale(saved)) {
      setUserChose(true);
      setLocaleState(saved);
      document.documentElement.lang = saved;
    }
  }, []);

  // Follow the admin's store-wide default until the visitor picks a language.
  useEffect(() => {
    if (userChose || !siteLocale || !isLocale(siteLocale)) return;
    setLocaleState(siteLocale);
    document.documentElement.lang = siteLocale;
  }, [siteLocale, userChose]);

  const setLocale = (l: Locale) => {
    setUserChose(true);
    setLocaleState(l);
    localStorage.setItem("locale", l);
    document.documentElement.lang = l;
  };

  const t = useCallback<Ctx["t"]>(
    (key, vars) => {
      const dict = strings ?? EMPTY_STRINGS;
      return interpolate(dict[locale]?.[key] ?? dict.en?.[key] ?? key, vars);
    },
    [locale, strings],
  );

  const tp = useCallback<Ctx["tp"]>(
    (id, field, fallback) => {
      const dict = strings ?? EMPTY_STRINGS;
      const override = dict[locale]?.[productTextKey(id, field)];
      return (override ?? fallback ?? "").toString();
    },
    [locale, strings],
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, tp }}>{children}</I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within LanguageProvider");
  return ctx;
}
