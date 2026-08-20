import { createFileRoute, Link } from "@tanstack/react-router";
import { HeroSlider } from "@/components/hero-slider";
import { ProductCard } from "@/components/product-card";
import { OfferSection } from "@/components/offer-section";
import { SpecialOfferBanner } from "@/components/special-offer-banner";
import { HorizontalScroller } from "@/components/horizontal-scroller";
import {
  useProducts,
  usePromotions,
  useStoreSettings,
  useAllVariations,
  useShippedOrderCount,
  useCategories,
} from "@/hooks/use-products";
import { ArrowRight, Truck, Globe, ShieldCheck, PackageCheck, Star } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import { groupVariations, productFromPrice } from "@/lib/variants";

export const Route = createFileRoute("/_store/")({
  head: () => ({
    meta: [
      { title: "BOSBA Drink Snack — Japanese Drinks & Snacks Delivered" },
      {
        name: "description",
        content:
          "Japanese drinks and snacks — imported beverages, chips, candy and more, delivered across Cambodia.",
      },
      { property: "og:url", content: "https://bosbadrinksnack.com/" },
    ],
    links: [{ rel: "canonical", href: "https://bosbadrinksnack.com/" }],
  }),
  component: Home,
});

// Emoji per category slug for the "Shop by Category" tiles. Categories carry no
// icon column, so this map keeps the artwork in code; unmapped slugs (e.g. a new
// category added in the admin) fall back to a neutral shopping bag.
const CATEGORY_ICONS: Record<string, string> = {
  "plum-wine": "🍶",
  shochu: "🥃",
  seaweed: "🌿",
  "premium-beer": "🍺",
  ingredient: "🧂",
  miso: "🍲",
  dessert: "🍡",
  convenient: "🍣",
};
const CATEGORY_ICON_FALLBACK = "🛍️";

function Home() {
  const { data: products = [] } = useProducts();
  const { data: promotions = [] } = usePromotions();
  const { data: settings } = useStoreSettings();
  const { data: variations = [] } = useAllVariations();
  const { data: shippedOrders = 0 } = useShippedOrderCount();
  const { data: categories = [] } = useCategories();
  const { user } = useAuth();
  const { t, locale } = useI18n();
  const variationsByProduct = groupVariations(variations);
  const offerSections = promotions
    .map((promo) => ({ promo, items: products.filter((p) => p.promotion_id === promo.id) }))
    .filter((s) => s.items.length > 0);
  const trending = [...products].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).slice(0, 12);
  const newArrivals = [...products]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 12);
  const shipThreshold = Number(settings?.free_shipping_threshold ?? 50);

  // Locale starts at "en" on the server and on the first client render (it only
  // switches in an effect), so both sides format the same string — no hydration
  // mismatch — and the copy never goes stale on a month rollover.
  const month = new Date().toLocaleDateString(locale, { month: "long" });

  // Rounds down to a "200+" style figure so the banner reads as a claim rather
  // than a live counter, and never overstates the real number.
  const roundDown = (n: number) => {
    if (n < 10) return String(n);
    if (n < 1000) return `${Math.floor(n / 10) * 10}+`;
    if (n < 10000) return `${(Math.floor(n / 100) / 10).toFixed(1)}K+`;
    return `${Math.floor(n / 1000)}K+`;
  };
  const rated = products.filter((p) => p.rating != null);
  const avgRating = rated.length
    ? (rated.reduce((sum, p) => sum + (p.rating ?? 0), 0) / rated.length).toFixed(1)
    : null;

  const drinkStats = [
    { value: roundDown(products.length), label: t("home.drinks.statBrands") },
    { value: roundDown(shippedOrders), label: t("home.drinks.statOrders") },
    ...(avgRating ? [{ value: avgRating, label: t("home.drinks.statRating"), star: true }] : []),
  ];

  const editorialCards = [
    {
      eyebrow: t("home.editorial.uniqueEyebrow"),
      title: t("home.editorial.uniqueTitle"),
      cta: t("home.editorial.uniqueCta"),
      to: "/shop",
    },
    {
      eyebrow: t("home.editorial.newEyebrow"),
      title: t("home.editorial.newTitle", { month }),
      cta: t("home.editorial.newCta"),
      to: "/offers",
    },
  ] as const;

  const features = [
    {
      icon: Truck,
      title: t("feature.delivery.title"),
      body: t("feature.delivery.body", { threshold: shipThreshold }),
    },
    { icon: Globe, title: t("feature.sashimi.title"), body: t("feature.sashimi.body") },
    { icon: ShieldCheck, title: t("feature.quality.title"), body: t("feature.quality.body") },
    { icon: PackageCheck, title: t("feature.cold.title"), body: t("feature.cold.body") },
  ];

  return (
    <div className="space-y-24 md:space-y-32 pb-24">
      <HeroSlider />

      {/* Special offer countdown banner — first active promo, horizontally scrollable */}
      {offerSections.length > 0 && (
        <SpecialOfferBanner
          promotion={offerSections[0].promo}
          products={offerSections[0].items}
          variationsByProduct={variationsByProduct}
          limit={12}
        />
      )}

      {/* Features strip — centered, borderless */}
      <section className="mx-auto max-w-6xl px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-10">
          {features.map((f) => (
            <div key={f.title} className="flex flex-col items-center text-center">
              <f.icon className="size-7 text-brand" strokeWidth={1.5} />
              <p className="font-display font-semibold text-base mt-4">{f.title}</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-[22ch]">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Shop by Category — icon tiles routing into the filtered catalogue */}
      {categories.length > 0 && (
        <section className="mx-auto max-w-6xl px-6">
          <div className="text-center">
            <h2 className="font-display text-3xl font-semibold tracking-tight md:text-5xl">
              {t("home.categories")}
            </h2>
            <p className="mt-3 text-base text-muted-foreground">{t("home.categoriesSub")}</p>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {categories.map((c) => (
              <Link
                key={c.id}
                to="/shop"
                search={{ category: c.slug }}
                className="group flex flex-col items-center gap-4 rounded-2xl bg-muted px-4 py-6 text-center transition-all hover:bg-accent hover:shadow-lantern"
              >
                <span
                  aria-hidden
                  className="grid size-20 place-items-center rounded-full bg-background text-3xl transition-transform duration-300 group-hover:scale-110"
                >
                  {CATEGORY_ICONS[c.slug] ?? CATEGORY_ICON_FALLBACK}
                </span>
                <span className="font-display text-sm font-semibold leading-tight">{c.name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Trending Products — left-aligned heading, horizontally scrollable row */}
      {trending.length > 0 && (
        <section className="mx-auto max-w-6xl px-6">
          <div className="flex items-center justify-between gap-4 mb-6">
            <h2 className="font-display font-semibold text-2xl md:text-3xl tracking-tight">
              {t("home.trending")}
            </h2>
            <Link
              to="/shop"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-brand transition-all hover:gap-2.5 shrink-0"
            >
              {t("home.viewAll")} <ArrowRight className="size-4" />
            </Link>
          </div>
          <HorizontalScroller
            scrollClassName="flex gap-4 pb-4 sm:gap-6"
            edgeFromClassName="from-background"
          >
            {trending.map((p) => (
              <div key={p.id} className="w-44 shrink-0 sm:w-56">
                <ProductCard
                  product={p}
                  fromPrice={productFromPrice(p, variationsByProduct.get(p.id) ?? [])}
                />
              </div>
            ))}
          </HorizontalScroller>
        </section>
      )}

      {/* Drinks banner — sits between the two product rows on the same surface as
          ProductCard, so it reads as part of the catalogue rather than an ad. */}
      <section className="mx-auto max-w-6xl px-6">
        <div className="rounded-3xl bg-muted p-8 md:p-12">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">
            {t("home.drinks.eyebrow")}
          </p>
          <h2 className="font-display mt-4 max-w-[24ch] text-balance text-2xl md:text-4xl font-semibold leading-[1.15] tracking-tight text-foreground">
            {t("home.drinks.title")}
          </h2>

          <div className="mt-8 flex flex-wrap gap-x-10 gap-y-6 sm:gap-x-14">
            {drinkStats.map((stat) => (
              <div key={stat.label}>
                <p className="font-display flex items-center gap-1 text-2xl md:text-3xl font-bold text-brand">
                  {stat.value}
                  {stat.star && <Star className="size-5 fill-warning text-warning" />}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>

          <Link
            to="/shop"
            className="group mt-9 inline-flex w-fit items-center gap-2 rounded-full bg-brand py-2.5 pl-5 pr-4 text-sm font-semibold text-brand-foreground shadow-sm transition-transform duration-200 hover:-translate-y-0.5"
          >
            {t("home.drinks.cta")}
            <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
          </Link>
        </div>
      </section>

      {/* New Arrivals — same layout as Trending Products */}
      {newArrivals.length > 0 && (
        <section className="mx-auto max-w-6xl px-6">
          <div className="flex items-center justify-between gap-4 mb-6">
            <h2 className="font-display font-semibold text-2xl md:text-3xl tracking-tight">
              {t("home.newArrivals")}
            </h2>
            <Link
              to="/shop"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-brand transition-all hover:gap-2.5 shrink-0"
            >
              {t("home.viewAll")} <ArrowRight className="size-4" />
            </Link>
          </div>
          <HorizontalScroller
            scrollClassName="flex gap-4 pb-4 sm:gap-6"
            edgeFromClassName="from-background"
          >
            {newArrivals.map((p) => (
              <div key={p.id} className="w-44 shrink-0 sm:w-56">
                <ProductCard
                  product={p}
                  fromPrice={productFromPrice(p, variationsByProduct.get(p.id) ?? [])}
                />
              </div>
            ))}
          </HorizontalScroller>
        </section>
      )}

      {/* Editorial pair — two oversized cards on the same surface as ProductCard,
          breaking up the run of product rows and routing into the catalogue. */}
      <section className="mx-auto max-w-6xl px-6">
        <div className="grid gap-4 md:grid-cols-2 md:gap-6">
          {editorialCards.map((card) => (
            <Link
              key={card.title}
              to={card.to}
              // Same surface treatment as ProductCard: bg-muted, gold accent on
              // hover, warm lantern shadow.
              className="group flex min-h-[240px] flex-col justify-end overflow-hidden rounded-3xl bg-muted p-8 transition-all hover:bg-accent hover:shadow-lantern md:min-h-[300px] md:p-10"
            >
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">
                {card.eyebrow}
              </p>
              <h3 className="font-display mt-4 max-w-[19ch] text-balance text-2xl md:text-[2rem] font-semibold leading-[1.15] tracking-tight text-foreground">
                {card.title}
              </h3>
              <span className="mt-7 inline-flex w-fit items-center gap-2 rounded-full bg-brand py-2.5 pl-5 pr-4 text-sm font-semibold text-brand-foreground shadow-sm transition-transform duration-200 group-hover:-translate-y-0.5">
                {card.cta}
                <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Offers */}
      {offerSections.length > 0 && (
        <div className="mx-auto max-w-6xl px-6 space-y-16">
          {offerSections.map(({ promo, items }) => (
            <OfferSection
              key={promo.id}
              promotion={promo}
              products={items}
              variationsByProduct={variationsByProduct}
              limit={8}
            />
          ))}
          <div className="text-center">
            <Link
              to="/offers"
              className="inline-flex items-center gap-1.5 text-base font-medium text-brand transition-all hover:gap-2.5"
            >
              {t("offers.viewAll")} <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      )}

      {/* CTA Banner — centered, soft fill. The Join button is hidden once logged in. */}
      <section className="mx-auto max-w-6xl px-6">
        <div className="lantern-glow rounded-3xl bg-muted px-6 py-20 md:py-28 text-center overflow-hidden">
          <p className="text-sm font-medium uppercase tracking-widest text-brand mb-4">
            {t("cta.member")}
          </p>
          <h3 className="font-display font-semibold text-4xl md:text-6xl text-foreground tracking-tight max-w-3xl mx-auto">
            {t("cta.title")}
          </h3>
          <p className="text-lg text-muted-foreground mt-5 max-w-xl mx-auto">{t("cta.body")}</p>
          {!user && (
            <Link
              to="/auth"
              className="inline-flex mt-8 items-center gap-2 rounded-full bg-brand text-brand-foreground px-7 py-3 text-sm font-semibold hover:bg-secondary-accent transition-colors"
            >
              {t("cta.join")} <ArrowRight className="size-4" />
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
