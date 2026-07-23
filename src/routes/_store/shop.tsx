import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useCategories, useProducts } from "@/hooks/use-products";
import { ProductCard } from "@/components/product-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, SlidersHorizontal } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useI18n } from "@/lib/i18n";
import { useAllVariations } from "@/hooks/use-products";
import { groupVariations, productFromPrice } from "@/lib/variants";
import type { Product } from "@/lib/types";

type Search = { category?: string; q?: string };

type Sort = "featured" | "price-asc" | "price-desc" | "rating";

const isOnSale = (p: Product) => p.sale_price != null && p.sale_price < p.price;

export const Route = createFileRoute("/_store/shop")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    category: typeof s.category === "string" ? s.category : undefined,
    q: typeof s.q === "string" ? s.q : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Shop — BOSBA Premium Foods" },
      {
        name: "description",
        content:
          "Browse premium Japanese seafood and foods — sashimi-grade tuna, salmon, uni, scallops and more, delivered chilled.",
      },
      { property: "og:url", content: "https://bosbapremiumfoods.com/shop" },
    ],
    links: [{ rel: "canonical", href: "https://bosbapremiumfoods.com/shop" }],
  }),
  component: Shop,
});

function Shop() {
  const search = Route.useSearch();
  const { data: products = [], isLoading } = useProducts();
  const { data: categories = [] } = useCategories();
  const { data: variations = [] } = useAllVariations();
  // Variable products price from their cheapest variation; simple products from
  // their own price.
  const variationsByProduct = groupVariations(variations);
  const displayPrice = (p: Product) => productFromPrice(p, variationsByProduct.get(p.id) ?? []);
  const { t } = useI18n();
  const [query, setQuery] = useState(search.q ?? "");
  const [activeCat, setActiveCat] = useState<string | undefined>(search.category);
  const [sort, setSort] = useState<Sort>("featured");

  // The Shop component stays mounted across category links in the nav, so the
  // useState initializers above don't re-run. Sync local filter state when the
  // URL search params change (e.g. clicking a category in the top bar).
  useEffect(() => setActiveCat(search.category), [search.category]);
  useEffect(() => setQuery(search.q ?? ""), [search.q]);
  const [range, setRange] = useState<[number, number] | null>(null);
  const [onSale, setOnSale] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const catId = activeCat ? categories.find((c) => c.slug === activeCat)?.id : undefined;

  // Price slider bounds derived from the catalog (cheapest variant per product).
  const prices = products.map(displayPrice);
  const floor = prices.length ? Math.floor(Math.min(...prices)) : 0;
  let ceil = prices.length ? Math.ceil(Math.max(...prices)) : 100;
  if (ceil <= floor) ceil = floor + 1; // keep the slider range non-degenerate
  const [lo, hi] = range ?? [floor, ceil];
  const priceActive = lo > floor || hi < ceil;

  const filtersActive = !!activeCat || query.trim() !== "" || priceActive || onSale;

  const resetFilters = () => {
    setActiveCat(undefined);
    setQuery("");
    setRange(null);
    setOnSale(false);
    setSort("featured");
  };

  const filtered = products.filter((p) => {
    if (catId && p.category_id !== catId) return false;
    if (query && !p.title.toLowerCase().includes(query.toLowerCase())) return false;
    if (onSale && !isOnSale(p)) return false;
    const price = displayPrice(p);
    if (price < lo || price > hi) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    switch (sort) {
      case "price-asc":
        return displayPrice(a) - displayPrice(b);
      case "price-desc":
        return displayPrice(b) - displayPrice(a);
      case "rating":
        return (b.rating ?? 0) - (a.rating ?? 0);
      default:
        return 0; // "featured" — keep server order (newest first)
    }
  });

  const filterPanel = (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          {t("shop.filters")}
        </span>
        {filtersActive && (
          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            className="h-auto px-2 py-1 text-xs text-brand hover:text-secondary-accent"
          >
            {t("shop.clearAll")}
          </Button>
        )}
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
          {t("shop.search")}
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("shop.searchPlaceholder")}
            className="pl-9 rounded-full"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
          {t("shop.categories")}
        </label>
        <div className="space-y-1">
          <button
            onClick={() => setActiveCat(undefined)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${!activeCat ? "bg-brand text-brand-foreground font-bold" : "hover:bg-muted"}`}
          >
            {t("shop.allProducts")}
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCat(c.slug)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${activeCat === c.slug ? "bg-brand text-brand-foreground font-bold" : "hover:bg-muted"}`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            {t("shop.price")}
          </label>
          <span className="text-xs font-medium text-brand">
            ${lo} – ${hi}
          </span>
        </div>
        <Slider
          min={floor}
          max={ceil}
          step={1}
          value={[lo, hi]}
          onValueChange={(v) => setRange([v[0], v[1]])}
          className="mt-1"
        />
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
          {t("shop.offers")}
        </label>
        <label className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-muted cursor-pointer text-sm">
          <Checkbox checked={onSale} onCheckedChange={(v) => setOnSale(v === true)} />
          {t("shop.onSaleOnly")}
        </label>
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 md:px-6 py-8 md:py-10">
      <div className="mb-6 md:mb-10">
        <h1 className="font-display font-semibold tracking-tight text-3xl md:text-5xl">
          {t("shop.title")}
        </h1>
        <p className="text-muted-foreground mt-2">{t("shop.count", { n: sorted.length })}</p>
      </div>

      <div className="grid lg:grid-cols-[240px_1fr] gap-8">
        <aside className="hidden lg:block self-start sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-1">
          {filterPanel}
        </aside>

        <div>
          <div className="flex items-center justify-between gap-2 mb-6">
            <Button
              variant="outline"
              onClick={() => setFiltersOpen(true)}
              className="lg:hidden gap-2 rounded-full"
            >
              <SlidersHorizontal className="size-4" />
              {t("shop.filters")}
              {filtersActive && <span className="size-2 rounded-full bg-brand" />}
            </Button>
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs uppercase tracking-widest text-muted-foreground hidden sm:inline">
                {t("shop.sort")}
              </span>
              <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
                <SelectTrigger className="w-40 sm:w-48 rounded-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="featured">{t("shop.sort.featured")}</SelectItem>
                  <SelectItem value="price-asc">{t("shop.sort.priceAsc")}</SelectItem>
                  <SelectItem value="price-desc">{t("shop.sort.priceDesc")}</SelectItem>
                  <SelectItem value="rating">{t("shop.sort.rating")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[4/5] rounded-2xl" />
              ))}
            </div>
          ) : sorted.length === 0 ? (
            <div className="text-center py-20 rounded-3xl bg-muted">
              <p className="font-display font-semibold text-xl">{t("shop.noProducts")}</p>
              <p className="text-muted-foreground text-sm mt-1">{t("shop.noProductsSub")}</p>
              {filtersActive && (
                <Button variant="outline" size="sm" onClick={resetFilters} className="mt-4">
                  {t("shop.clearFilters")}
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {sorted.map((p) => (
                <ProductCard key={p.id} product={p} fromPrice={displayPrice(p)} />
              ))}
            </div>
          )}
        </div>
      </div>

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="left" className="w-[86%] max-w-sm flex flex-col p-0">
          <SheetHeader className="px-5 py-4 border-b text-left">
            <SheetTitle className="font-display text-lg">{t("shop.filters")}</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-5 py-5">{filterPanel}</div>
          <div className="border-t px-5 py-4">
            <Button className="w-full rounded-full" onClick={() => setFiltersOpen(false)}>
              {t("shop.count", { n: sorted.length })}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
