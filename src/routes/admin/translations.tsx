import { createFileRoute } from "@tanstack/react-router";
import { type ComponentProps, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  deleteTranslationKey,
  getAcceptedKeys,
  getSiteLocale,
  getTranslationOverrides,
  saveTranslations,
  setAcceptedKey,
  setSiteLocale,
  type TranslationOverrides,
} from "@/data/translations";
import {
  I18N_KEYS,
  I18N_SECTIONS,
  LOCALES,
  notifyTranslationsChanged,
  productTextKey,
  type ProductTextField,
} from "@/lib/i18n";
import { useCategories, useProducts } from "@/hooks/use-products";
import { setProductText } from "@/data/products";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Check, Loader2, Plus, RotateCcw, Search, Trash2 } from "lucide-react";
import { useConfirm } from "@/components/common/confirm-dialog";

export const Route = createFileRoute("/admin/translations")({ component: TranslationsAdmin });

// A Textarea that grows to fit its content — no inner scrollbar, height always
// follows the text. `minRows` sets the shortest it can be.
function AutoTextarea({
  value,
  minRows = 2,
  className,
  ...props
}: ComponentProps<typeof Textarea> & { minRows?: number }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);
  // Re-fit whenever the value changes from outside (typing, discard, refetch).
  useEffect(fit, [value, fit]);
  return (
    <Textarea
      {...props}
      ref={ref}
      value={value}
      rows={minRows}
      onInput={fit}
      className={cn("resize-none overflow-hidden", className)}
    />
  );
}

type LocaleCode = (typeof LOCALES)[number]["code"];

// `cta.*` is the old membership banner — no longer on the storefront, so it's
// hidden from the editor.
const ALL_KEYS = (I18N_KEYS as readonly string[]).filter((k) => !k.startsWith("cta."));

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

// A pseudo-section for editing/translating individual products (their name and
// description). Named "Product Text" so it isn't confused with "Product Page"
// (the storefront wording on the product page). Its keys aren't in I18N_KEYS —
// they're built per product as `product.<id>.<field>` and stored in the same
// translations table.
const PRODUCTS_SECTION = "Product Text";
SECTIONS.push({ label: PRODUCTS_SECTION, short: "Product Text" });

// Reserved key prefixes an editor's added string must never use.
const RESERVED_KEY_PREFIXES = ["product.", "cta.", "_"];
const KNOWN_KEYS = new Set(I18N_KEYS as readonly string[]);
// A key an editor added here (not shipped in the code, not a product/sentinel).
const isCustomKey = (k: string) =>
  !KNOWN_KEYS.has(k) && !RESERVED_KEY_PREFIXES.some((p) => k.startsWith(p));
// The part after a section prefix — one or more lowercase dotted segments.
const KEY_SUFFIX_RE = /^[a-z0-9]+(?:\.[a-z0-9]+)*$/;

// label → key prefix, for the sections an editor can add strings to. A string
// added under "Homepage" is stored as `home.<suffix>` so it shows on that tab.
const SECTION_PREFIX_BY_LABEL: Record<string, string> = Object.fromEntries(
  I18N_SECTIONS.filter((s) => SECTIONS.some((x) => x.label === s.label)).map((s) => [
    s.label,
    s.prefix,
  ]),
);

const PRODUCT_FIELDS: { field: ProductTextField; label: string }[] = [
  { field: "title", label: "Title" },
  { field: "description", label: "Description" },
  { field: "badge", label: "Badge" },
];

// The Products section works as a short queue: it shows a batch of products that
// still need a ខ្មែរ or 日本語 translation of their name or description. Once a
// product's boxes are filled in and saved it drops off the list and the next
// untranslated one takes its place. Badge isn't part of the queue (it's still
// reachable through search).
const PRODUCTS_BATCH = 10;
const PRODUCT_QUEUE_FIELDS: ProductTextField[] = ["title", "description"];

// Script detection — a field "needs" a language when it's blank or has no
// characters of that script (so an English brand name left in the Khmer box
// still counts as untranslated).
const KHMER_RE = /[ក-៿]/;
const JAPANESE_RE = /[぀-ヿ㐀-䶿一-鿿豈-﫿ｦ-ﾟ]/;

const missingScript = (locale: "km" | "ja", value: string) => {
  const v = value.trim();
  if (v === "") return true;
  return locale === "km" ? !KHMER_RE.test(v) : !JAPANESE_RE.test(v);
};

type Draft = Record<string, Partial<Record<LocaleCode, string>>>;
type Mode = "all" | "edited" | "km" | "ja";

const MODES: { key: Mode; label: string }[] = [
  { key: "all", label: "All" },
  { key: "edited", label: "Editing" },
  { key: "km", label: "Needs ខ្មែរ" },
  { key: "ja", label: "Needs 日本語" },
];

function TranslationsAdmin() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { data: overrides, isLoading } = useQuery<TranslationOverrides>({
    queryKey: ["translations"],
    queryFn: () => getTranslationOverrides(),
  });
  // Per-language: keys the editor accepted as "same as English is fine here", so
  // that field isn't flagged even though it holds no Khmer/Japanese script.
  const { data: acceptedList } = useQuery<Record<"km" | "ja", string[]>>({
    queryKey: ["translations-accepted"],
    queryFn: () => getAcceptedKeys(),
  });
  const acceptedKm = useMemo(() => new Set(acceptedList?.km ?? []), [acceptedList]);
  const acceptedJa = useMemo(() => new Set(acceptedList?.ja ?? []), [acceptedList]);
  const acceptedFor = (locale: "km" | "ja") => (locale === "km" ? acceptedKm : acceptedJa);

  // Every product (all statuses) — the "Products" section lets each one's title,
  // description and badge be translated. English always comes from the product's
  // own column, so it's shown read-only next to the km/ja boxes.
  const { data: products = [] } = useProducts({ all: true });
  const { data: categories = [] } = useCategories();
  // "Product Text" section: narrow the list to one category. "all" = every product.
  const [productCategory, setProductCategory] = useState<string>("all");

  // key → info for product rows: the product id + which field, its label, the
  // product name, and the English source text (the product's own column).
  const productMeta = useMemo(() => {
    const m = new Map<
      string,
      { id: string; fieldKey: ProductTextField; name: string; field: string; english: string }
    >();
    for (const p of products) {
      for (const { field, label } of PRODUCT_FIELDS) {
        const english =
          field === "title" ? p.title : field === "description" ? p.description : p.badge;
        // Badge only shows up when it already has text; name and description are
        // always editable here (the editor can fill in a missing description
        // without opening the product form).
        if (field === "badge" && !english?.trim()) continue;
        m.set(productTextKey(p.id, field), {
          id: p.id,
          fieldKey: field,
          name: p.title,
          field: label,
          english: english ?? "",
        });
      }
    }
    return m;
  }, [products]);

  const productKeys = useMemo(
    () =>
      products.flatMap((p) =>
        PRODUCT_FIELDS.map((f) => productTextKey(p.id, f.field)).filter((k) => productMeta.has(k)),
      ),
    [products, productMeta],
  );

  // Name + description keys that actually have English text — the Products
  // section's progress bar is measured against these (badge isn't part of that
  // flow, and an empty English field has nothing to translate).
  const productQueueKeys = useMemo(
    () =>
      products
        .filter((p) => productCategory === "all" || p.category_id === productCategory)
        .flatMap((p) =>
          PRODUCT_QUEUE_FIELDS.map((f) => productTextKey(p.id, f)).filter(
            (k) => (productMeta.get(k)?.english ?? "").trim() !== "",
          ),
        ),
    [products, productMeta, productCategory],
  );

  // Store-wide default language for the storefront.
  const { data: siteLocale } = useQuery<LocaleCode>({
    queryKey: ["site-locale"],
    queryFn: () => getSiteLocale(),
  });
  const [savingLocale, setSavingLocale] = useState(false);
  const changeSiteLocale = async (loc: LocaleCode, label: string) => {
    if (loc === siteLocale) return;
    setSavingLocale(true);
    try {
      await setSiteLocale({ data: { locale: loc } });
      await qc.invalidateQueries({ queryKey: ["site-locale"] });
      notifyTranslationsChanged();
      toast.success(`Website now opens in ${label} by default`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not change the default language");
    } finally {
      setSavingLocale(false);
    }
  };

  // Only edited fields live here; everything else renders from the saved DB value.
  const [draft, setDraft] = useState<Draft>({});
  const [query, setQuery] = useState("");
  const [section, setSection] = useState<string>(SECTIONS[0].label);
  const [mode, setMode] = useState<Mode>("all");
  const [saving, setSaving] = useState(false);

  const searching = query.trim() !== "";
  const isProducts = !searching && section === PRODUCTS_SECTION;

  // Keys an editor added with "Add text" — anything in the overrides that isn't a
  // known code key, a product key or a sentinel. Each shows on the section its
  // prefix maps to (e.g. `home.*` → Homepage).
  const customKeys = useMemo(() => {
    const s = new Set<string>();
    for (const l of LOCALES) {
      for (const k of Object.keys(overrides?.[l.code] ?? {})) {
        if (isCustomKey(k)) s.add(k);
      }
    }
    return [...s].sort();
  }, [overrides]);

  // Tabs: the built-in sections plus an "Other" catch-all if the editor added a
  // key whose prefix matches no section.
  const sectionTabs = useMemo(() => {
    const tabs = [...SECTIONS];
    if (
      customKeys.some((k) => SECTION_FOR(k) === "Other") &&
      !tabs.some((t) => t.label === "Other")
    ) {
      tabs.push({ label: "Other", short: "Other" });
    }
    return tabs;
  }, [customKeys]);

  // Which section prefix (if any) new text added on the current tab gets.
  const addPrefix = !searching && !isProducts ? (SECTION_PREFIX_BY_LABEL[section] ?? "") : "";
  const canAddHere = addPrefix !== "";

  // Current value shown in a field: unsaved edit → value stored in the DB → "".
  const valueOf = (locale: LocaleCode, key: string) =>
    draft[key]?.[locale] ?? overrides?.[locale]?.[key] ?? "";

  // Value stored in the DB (no unsaved draft). The "needs work" counts and the
  // section filter run off this, so nothing moves until you actually click Save.
  const savedValue = (locale: LocaleCode, key: string) => overrides?.[locale]?.[key] ?? "";

  const setValue = (locale: LocaleCode, key: string, v: string) =>
    setDraft((d) => ({ ...d, [key]: { ...d[key], [locale]: v } }));

  // Has an unsaved edit in some language (drives the "Edited" filter).
  const keyEdited = (key: string) =>
    LOCALES.some((l) => {
      const d = draft[key]?.[l.code];
      return d !== undefined && d.trim() !== savedValue(l.code, key).trim();
    });

  // Section counts + the "Needs ខ្មែរ/日本語" filter: based on the saved value.
  // A field accepted as "same as English" never counts as needing work.
  const savedNeeds = (locale: "km" | "ja", key: string) =>
    !acceptedFor(locale).has(key) && missingScript(locale, savedValue(locale, key));

  // Products for the "Product Text" section, optionally scoped to one category.
  // Without a category it's a queue: only products that still need a ខ្មែរ or
  // 日本語 translation of their name/description, untranslated ones first. With a
  // category chosen it's every product in that category (so an editor can revise
  // English text too), still untranslated-first. Sliced to `PRODUCTS_BATCH`.
  const needsWork = (p: (typeof products)[number]) =>
    PRODUCT_QUEUE_FIELDS.some((f) => {
      const k = productTextKey(p.id, f);
      if ((productMeta.get(k)?.english ?? "").trim() === "") return false;
      return savedNeeds("km", k) || savedNeeds("ja", k);
    });

  const productQueue = useMemo(() => {
    const scoped =
      productCategory === "all"
        ? products
        : products.filter((p) => p.category_id === productCategory);
    const pending = scoped.filter(needsWork);
    const pool =
      productCategory === "all" ? pending : [...pending, ...scoped.filter((p) => !needsWork(p))];
    return { pending, pool, shown: pool.slice(0, PRODUCTS_BATCH) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, productMeta, overrides, acceptedList, productCategory]);

  const productSectionKeys = useMemo(
    () =>
      productQueue.shown.flatMap((p) =>
        PRODUCT_QUEUE_FIELDS.map((f) => productTextKey(p.id, f)).filter((k) => productMeta.has(k)),
      ),
    [productQueue, productMeta],
  );

  const toggleAccept = async (key: string, locale: "km" | "ja", next: boolean) => {
    try {
      await setAcceptedKey({ data: { key, locale, accepted: next } });
      await qc.invalidateQueries({ queryKey: ["translations-accepted"] });
      toast.success(next ? "Marked “same as English”" : "Back to needing a translation");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update");
    }
  };

  // English for a product row is the product's own column — edited inline here
  // and written straight back to the product (no need to open the product form).
  // Kept in its own draft, saved per-field, separate from the km/ja overrides.
  const [englishDraft, setEnglishDraft] = useState<Record<string, string>>({});
  const [savingEnglish, setSavingEnglish] = useState<string | null>(null);
  const englishValue = (key: string) => englishDraft[key] ?? productMeta.get(key)?.english ?? "";
  const englishChanged = (key: string) => {
    const d = englishDraft[key];
    return d !== undefined && d.trim() !== (productMeta.get(key)?.english ?? "").trim();
  };
  const saveEnglish = async (key: string) => {
    const pm = productMeta.get(key);
    if (!pm) return;
    setSavingEnglish(key);
    try {
      await setProductText({
        data: { id: pm.id, field: pm.fieldKey, value: englishValue(key) },
      });
      await qc.invalidateQueries({ queryKey: ["products"] });
      await qc.invalidateQueries({ queryKey: ["product", pm.id] });
      setEnglishDraft((d) => {
        const { [key]: _drop, ...rest } = d;
        return rest;
      });
      notifyTranslationsChanged();
      toast.success(`Updated the English ${pm.field.toLowerCase()}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the product");
    } finally {
      setSavingEnglish(null);
    }
  };

  // ── "Add text": create a new string on the current section ───────────────
  const [showAdd, setShowAdd] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newText, setNewText] = useState<Record<LocaleCode, string>>({ en: "", km: "", ja: "" });
  const [addingKey, setAddingKey] = useState(false);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  const newKeySuffix = newKey
    .trim()
    .toLowerCase()
    .replace(/^\.+|\.+$/g, "");
  const fullNewKey = addPrefix && newKeySuffix ? `${addPrefix}.${newKeySuffix}` : "";
  const keyExists = (k: string) => KNOWN_KEYS.has(k) || customKeys.includes(k);
  const newKeyError =
    newKeySuffix === ""
      ? null
      : !KEY_SUFFIX_RE.test(newKeySuffix)
        ? "Letters, numbers and dots only"
        : keyExists(fullNewKey)
          ? "That key already exists"
          : null;
  const canAddKey = fullNewKey !== "" && !newKeyError && newText.en.trim() !== "" && !addingKey;

  const resetAddForm = () => {
    setShowAdd(false);
    setNewKey("");
    setNewText({ en: "", km: "", ja: "" });
  };

  const addCustomKey = async () => {
    if (!canAddKey) return;
    setAddingKey(true);
    try {
      const entries = LOCALES.map((l) => ({
        locale: l.code,
        key: fullNewKey,
        value: newText[l.code].trim(),
      })).filter((e) => e.value !== "");
      await saveTranslations({ data: { entries } });
      await qc.invalidateQueries({ queryKey: ["translations"] });
      notifyTranslationsChanged();
      resetAddForm();
      setMode("all");
      toast.success(`Added “${fullNewKey}”`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add the text");
    } finally {
      setAddingKey(false);
    }
  };

  const deleteCustomKey = async (key: string) => {
    const ok = await confirm({
      title: `Delete “${key}”?`,
      description:
        "This text will be permanently removed in all languages. Anywhere a page uses it will fall back to the key name. This cannot be undone.",
      confirmText: "Delete text",
    });
    if (!ok) return;
    setDeletingKey(key);
    try {
      await deleteTranslationKey({ data: { key } });
      await qc.invalidateQueries({ queryKey: ["translations"] });
      await qc.invalidateQueries({ queryKey: ["translations-accepted"] });
      notifyTranslationsChanged();
      setDraft((d) => {
        const { [key]: _drop, ...rest } = d;
        return rest;
      });
      toast.success(`Removed “${key}”`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove the text");
    } finally {
      setDeletingKey(null);
    }
  };

  const dirtyEntries = useMemo(() => {
    const out: { locale: string; key: string; value: string }[] = [];
    for (const [key, byLocale] of Object.entries(draft)) {
      for (const [locale, v] of Object.entries(byLocale)) {
        const saved = overrides?.[locale as LocaleCode]?.[key] ?? "";
        // A blank value clears the row server-side (storefront then falls back to
        // English, then to the raw key).
        if (v.trim() !== saved.trim()) out.push({ locale, key, value: v });
      }
    }
    return out;
  }, [draft, overrides]);

  const visibleKeys = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = searching
      ? [
          ...[...ALL_KEYS, ...customKeys].filter(
            (k) =>
              k.toLowerCase().includes(q) ||
              (KEY_LABELS[k] ?? "").toLowerCase().includes(q) ||
              LOCALES.some((l) => valueOf(l.code, k).toLowerCase().includes(q)),
          ),
          ...productKeys.filter((k) => {
            const meta = productMeta.get(k);
            return (
              meta &&
              (meta.name.toLowerCase().includes(q) ||
                meta.english.toLowerCase().includes(q) ||
                valueOf("km", k).toLowerCase().includes(q) ||
                valueOf("ja", k).toLowerCase().includes(q))
            );
          }),
        ]
      : isProducts
        ? productSectionKeys
        : // Built-in keys of this section, plus any the editor added whose prefix
          // maps here (e.g. `home.*` under Homepage).
          [
            ...(KEYS_BY_SECTION[section] ?? []),
            ...customKeys.filter((k) => SECTION_FOR(k) === section),
          ];
    return base.filter((k) => {
      if (mode === "edited") return keyEdited(k);
      if (mode === "km") return savedNeeds("km", k);
      if (mode === "ja") return savedNeeds("ja", k);
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    query,
    searching,
    section,
    isProducts,
    mode,
    draft,
    overrides,
    acceptedList,
    productKeys,
    productSectionKeys,
    customKeys,
  ]);

  // Products section: the visible keys regrouped under their product, so each
  // product renders as one card (image + its name/description fields) instead of
  // one card per field. Empty groups (all fields filtered out) are dropped.
  const productGroups = useMemo(
    () =>
      productQueue.shown
        .map((p) => ({
          product: p,
          keys: PRODUCT_QUEUE_FIELDS.map((f) => productTextKey(p.id, f)).filter(
            (k) => productMeta.has(k) && visibleKeys.includes(k),
          ),
        }))
        .filter((g) => g.keys.length > 0),
    [productQueue, productMeta, visibleKeys],
  );

  // Nothing is saved until the button is pressed — warn before losing edits.
  const hasUnsaved =
    dirtyEntries.length > 0 || Object.keys(englishDraft).some((k) => englishChanged(k));
  useEffect(() => {
    if (!hasUnsaved) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasUnsaved]);

  // When a "Needs …" filter is on, spotlight that one language on every card and
  // put it right after English (the source to translate from).
  const focusLocale: "km" | "ja" | null = mode === "km" ? "km" : mode === "ja" ? "ja" : null;
  const orderedLocales = focusLocale === "ja" ? [LOCALES[0], LOCALES[2], LOCALES[1]] : LOCALES;
  const focusLabel = focusLocale === "km" ? "ខ្មែរ (Khmer)" : "日本語 (Japanese)";

  // Translation progress for the current view (a section, or the whole store
  // while searching), per language — drives the summary bar.
  const progress = useMemo(() => {
    const keys = searching
      ? [...ALL_KEYS, ...productKeys, ...customKeys]
      : isProducts
        ? productQueueKeys
        : [
            ...(KEYS_BY_SECTION[section] ?? []),
            ...customKeys.filter((k) => SECTION_FOR(k) === section),
          ];
    const per = (loc: "km" | "ja") => {
      const total = keys.length;
      const left = keys.filter((k) => savedNeeds(loc, k)).length;
      return {
        total,
        done: total - left,
        left,
        pct: total ? Math.round(((total - left) / total) * 100) : 100,
      };
    };
    return { km: per("km"), ja: per("ja") };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    searching,
    section,
    isProducts,
    overrides,
    acceptedList,
    productKeys,
    productQueueKeys,
    customKeys,
  ]);

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

  // The three (or two, for products) locale boxes for one key — shared by the
  // flat card list and the grouped Products cards.
  const localeGrid = (key: string) => {
    const pm = productMeta.get(key);
    const englishSource = pm ? englishValue(key) : valueOf("en", key);
    return (
      <div className="grid gap-3 md:grid-cols-3">
        {orderedLocales.map((l) => {
          const changed = valueOf(l.code, key) !== savedValue(l.code, key);
          const tgt = l.code as "km" | "ja";
          const acceptedHere = l.code !== "en" && acceptedFor(tgt).has(key);
          // Live: the dot clears as soon as you type text in that
          // script, even before saving. For a product row with no English text
          // there's nothing to translate, so it isn't flagged.
          const needs =
            l.code !== "en" &&
            !acceptedHere &&
            missingScript(tgt, valueOf(l.code, key)) &&
            (!pm || englishSource.trim() !== "");
          const isFocus = focusLocale === l.code;
          const isSecondary = !!focusLocale && l.code !== "en" && l.code !== focusLocale;
          // Product rows: English is the product's own column — edited inline
          // here and saved straight back to the product.
          if (pm && l.code === "en") {
            const eChanged = englishChanged(key);
            const eSaving = savingEnglish === key;
            return (
              <div key={l.code} className={cn(isSecondary && "opacity-50")}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="flex items-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {l.label}
                    <span className="ml-1.5 normal-case font-normal opacity-70">
                      (the product itself)
                    </span>
                  </span>
                  {eChanged && (
                    <button
                      type="button"
                      onClick={() =>
                        setEnglishDraft((d) => {
                          const { [key]: _drop, ...rest } = d;
                          return rest;
                        })
                      }
                      title="Discard this change"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <RotateCcw className="size-3" />
                    </button>
                  )}
                </div>
                <AutoTextarea
                  value={englishValue(key)}
                  onChange={(e) => setEnglishDraft((d) => ({ ...d, [key]: e.target.value }))}
                  dir="ltr"
                  className={cn("min-h-10 text-sm", eChanged && "border-brand/50 bg-brand/5")}
                />
                {eChanged && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-1.5 h-7"
                    disabled={eSaving}
                    onClick={() => saveEnglish(key)}
                  >
                    {eSaving && <Loader2 className="mr-1.5 size-3 animate-spin" />}
                    Save {pm.field.toLowerCase()} to product
                  </Button>
                )}
              </div>
            );
          }
          return (
            <div key={l.code} className={cn(isSecondary && "opacity-50")}>
              <div className="mb-1 flex items-center justify-between gap-2">
                <span
                  className={cn(
                    "flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide",
                    isFocus ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground",
                  )}
                >
                  {l.label}
                  {isFocus && <span className="normal-case">— translate this</span>}
                  {acceptedHere && (
                    <span className="flex items-center gap-1 normal-case font-medium text-emerald-600 dark:text-emerald-400">
                      <Check className="size-3" /> = English
                      <button
                        type="button"
                        onClick={() => toggleAccept(key, tgt, false)}
                        className="underline hover:no-underline"
                      >
                        undo
                      </button>
                    </span>
                  )}
                  {needs && (
                    <>
                      {!isFocus && (
                        <span
                          className="size-1.5 rounded-full bg-amber-500"
                          title={`No ${l.label} text yet`}
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => toggleAccept(key, tgt, true)}
                        className="normal-case font-medium text-muted-foreground underline hover:text-foreground"
                      >
                        same as English
                      </button>
                    </>
                  )}
                </span>
                {changed && (
                  <button
                    type="button"
                    onClick={() => setValue(l.code, key, savedValue(l.code, key))}
                    title="Discard this change"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <RotateCcw className="size-3" />
                  </button>
                )}
              </div>
              <Textarea
                value={valueOf(l.code, key)}
                onChange={(e) => setValue(l.code, key, e.target.value)}
                rows={isFocus ? 3 : 2}
                dir="ltr"
                placeholder={isFocus ? `${l.label} translation of “${englishSource}”` : undefined}
                className={cn(
                  "min-h-10 resize-y text-sm",
                  changed && "border-brand/50 bg-brand/5",
                  isFocus &&
                    needs &&
                    "border-amber-400 bg-amber-50/50 ring-2 ring-amber-300 dark:bg-amber-500/5",
                  isFocus && !needs && "border-emerald-400",
                )}
              />
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="pb-24">
      <header className="mb-6">
        <h1 className="font-display font-bold text-3xl">Translations</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Storefront wording in English, ខ្មែរ and 日本語 — stored in the database, not the code.
          Clearing a field makes it fall back to the English text. Keep tags like{" "}
          <code className="bg-muted px-1 rounded text-xs">{"{threshold}"}</code> and{" "}
          <code className="bg-muted px-1 rounded text-xs">{"{n}"}</code> as they are.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
          <span className="text-sm font-medium">Default website language</span>
          <span className="text-xs text-muted-foreground">
            — what visitors see until they pick one themselves
          </span>
          <div className="ms-auto flex gap-1.5">
            {LOCALES.map((l) => (
              <button
                key={l.code}
                type="button"
                disabled={savingLocale}
                onClick={() => changeSiteLocale(l.code, l.label)}
                className={cn(
                  "rounded-full border px-3 py-1 text-sm font-medium transition-colors disabled:opacity-60",
                  siteLocale === l.code
                    ? "border-brand bg-brand text-brand-foreground"
                    : "bg-card text-foreground/70 hover:bg-muted hover:text-foreground",
                )}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="space-y-4">
          {/* ── Section tabs ─────────────────────────────────────────── */}
          <div className="flex flex-wrap gap-1.5">
            {sectionTabs.map((s) => {
              const active = !searching && section === s.label;
              return (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setSection(s.label);
                    setMode("all");
                    resetAddForm();
                  }}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                    active
                      ? "border-brand bg-brand text-brand-foreground"
                      : "border-border bg-card text-foreground/70 hover:bg-muted hover:text-foreground",
                  )}
                >
                  {s.short}
                </button>
              );
            })}
          </div>

          {/* ── Progress summary for the current view ─────────────────── */}
          <div className="divide-y rounded-xl border bg-card">
            {(["km", "ja"] as const).map((loc) => {
              const p = progress[loc];
              return (
                <div key={loc} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="w-14 shrink-0 text-sm font-medium">
                    {loc === "km" ? "ខ្មែរ" : "日本語"}
                  </span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full transition-[width]",
                        p.left === 0 ? "bg-emerald-500" : "bg-amber-500",
                      )}
                      style={{ width: `${p.pct}%` }}
                    />
                  </div>
                  <span className="w-9 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                    {p.pct}%
                  </span>
                  {p.left === 0 ? (
                    <span className="w-16 shrink-0 text-right text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      complete
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setMode(loc)}
                      className="w-16 shrink-0 text-right text-xs font-medium text-amber-700 underline hover:no-underline dark:text-amber-400"
                    >
                      {p.left} left
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Search + filter ──────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-50 flex-1 max-w-sm">
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
            <div className="flex rounded-lg border bg-card p-1">
              {MODES.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setMode(m.key)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-[13px] font-medium transition-colors",
                    mode === m.key
                      ? "bg-brand text-brand-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {canAddHere && (
              <Button
                variant={showAdd ? "secondary" : "outline"}
                size="sm"
                className="ms-auto"
                onClick={() => (showAdd ? resetAddForm() : setShowAdd(true))}
              >
                <Plus className="mr-1.5 size-4" />
                {showAdd ? "Cancel" : "Add text"}
              </Button>
            )}
          </div>

          <div className="space-y-3">
            {isProducts && !searching && (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">Category</span>
                  <Select value={productCategory} onValueChange={setProductCategory}>
                    <SelectTrigger className="w-56">
                      <SelectValue placeholder="All categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All categories</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {productCategory !== "all" && (
                    <button
                      type="button"
                      onClick={() => setProductCategory("all")}
                      className="text-xs text-muted-foreground underline hover:no-underline"
                    >
                      clear
                    </button>
                  )}
                </div>
                <div className="rounded-lg border bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
                  Edit each product’s name and description here. The English box is the product’s
                  own text — change it and press “Save … to product”. A blank ខ្មែរ or 日本語 box
                  falls back to the English text on the storefront.
                  {productQueue.pool.length > 0 && (
                    <span className="mt-1 block font-medium text-foreground">
                      {productCategory === "all"
                        ? `Showing ${productQueue.shown.length} of ${productQueue.pending.length} product${
                            productQueue.pending.length === 1 ? "" : "s"
                          } that still need a translation.`
                        : `Showing ${productQueue.shown.length} of ${productQueue.pool.length} product${
                            productQueue.pool.length === 1 ? "" : "s"
                          } in this category${
                            productQueue.pending.length > 0
                              ? ` (${productQueue.pending.length} still need a translation)`
                              : ""
                          }.`}
                    </span>
                  )}
                </div>
              </>
            )}
            {showAdd && canAddHere && !searching && (
              <div className="space-y-3 rounded-xl border bg-card p-4">
                <p className="text-xs text-muted-foreground">
                  New text for <strong className="text-foreground">{section}</strong>. Fill in
                  English (ខ្មែរ / 日本語 can wait). A developer then shows it with{" "}
                  <code className="rounded bg-muted px-1">
                    t(&quot;{fullNewKey || `${addPrefix}.your.key`}&quot;)
                  </code>
                  .
                </p>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Key
                  </label>
                  <div
                    className={cn(
                      "mt-1 flex items-center rounded-md border bg-transparent focus-within:ring-1 focus-within:ring-ring",
                      newKeyError && "border-destructive",
                    )}
                  >
                    <span className="pl-3 font-mono text-sm text-muted-foreground">
                      {addPrefix}.
                    </span>
                    <input
                      value={newKey}
                      onChange={(e) => setNewKey(e.target.value)}
                      placeholder="buy.name"
                      className="w-full bg-transparent px-3 py-2 font-mono text-sm outline-none placeholder:text-muted-foreground"
                    />
                  </div>
                  {newKeyError && <p className="mt-1 text-xs text-destructive">{newKeyError}</p>}
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  {LOCALES.map((l) => (
                    <div key={l.code}>
                      <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {l.label}
                        {l.code === "en" && <span className="ml-1 text-destructive">*</span>}
                      </label>
                      <Textarea
                        value={newText[l.code]}
                        onChange={(e) =>
                          setNewText((prev) => ({ ...prev, [l.code]: e.target.value }))
                        }
                        rows={2}
                        dir="ltr"
                        className="mt-1 min-h-10 resize-y text-sm"
                      />
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={addCustomKey} disabled={!canAddKey}>
                    {addingKey ? (
                      <Loader2 className="mr-1.5 size-4 animate-spin" />
                    ) : (
                      <Plus className="mr-1.5 size-4" />
                    )}
                    Add text
                  </Button>
                  <Button size="sm" variant="ghost" onClick={resetAddForm} disabled={addingKey}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
            {focusLocale && visibleKeys.length > 0 && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                These strings still need a <strong>{focusLabel}</strong> translation — type it in
                the highlighted box, or press “same as English” to leave it.
              </div>
            )}
            {visibleKeys.length === 0 ? (
              <div className="rounded-xl border border-dashed bg-card px-5 py-12 text-center text-sm text-muted-foreground">
                {mode === "km"
                  ? "Nothing here still needs ខ្មែរ. 🎉"
                  : mode === "ja"
                    ? "Nothing here still needs 日本語. 🎉"
                    : mode === "edited"
                      ? "Nothing edited here yet."
                      : searching
                        ? `No strings match “${query.trim()}”.`
                        : isProducts
                          ? products.length === 0
                            ? "No products yet."
                            : productCategory !== "all"
                              ? "No products in this category."
                              : "Every product’s name and description is translated. 🎉"
                          : "Nothing here."}
              </div>
            ) : isProducts && !searching ? (
              productGroups.map(({ product: p, keys }) => (
                <article key={p.id} className="rounded-xl border bg-card p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    {/* Column 1 — the product image, vertically centered */}
                    <div className="shrink-0 sm:w-44">
                      <div className="aspect-square overflow-hidden rounded-lg border bg-muted">
                        {p.image_url ? (
                          <img
                            src={p.image_url}
                            alt={p.title}
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="grid h-full w-full place-items-center text-center text-xs text-muted-foreground">
                            No image
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Column 2 — name + description translation boxes */}
                    <div className="min-w-0 flex-1 space-y-4">
                      {keys.map((key) => (
                        <div key={key}>
                          <div className="mb-1.5 flex items-center justify-between gap-2">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                              {productMeta.get(key)?.field}
                            </p>
                            <code className="text-[10px] text-muted-foreground/70">{key}</code>
                          </div>
                          {localeGrid(key)}
                        </div>
                      ))}
                    </div>
                  </div>
                </article>
              ))
            ) : (
              visibleKeys.map((key) => {
                const pm = productMeta.get(key);
                const custom = isCustomKey(key);
                return (
                  <article key={key} className="rounded-xl border bg-card p-4">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold leading-tight">
                          {pm ? pm.name : (KEY_LABELS[key] ?? key)}
                        </p>
                        {(pm || searching || custom) && (
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {pm
                              ? `Product · ${pm.field}`
                              : custom
                                ? "Added text"
                                : SECTION_FOR(key)}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <code className="text-[10px] text-muted-foreground/70">{key}</code>
                        {custom && (
                          <button
                            type="button"
                            onClick={() => deleteCustomKey(key)}
                            disabled={deletingKey === key}
                            title="Delete this text"
                            className="text-muted-foreground hover:text-destructive disabled:opacity-50"
                          >
                            {deletingKey === key ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="size-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                    {localeGrid(key)}
                  </article>
                );
              })
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
