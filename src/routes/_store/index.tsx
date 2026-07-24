import { createFileRoute, Link } from "@tanstack/react-router";
import { HeroSlider } from "@/components/hero-slider";
import { ProductCard } from "@/components/product-card";
import { OfferSection } from "@/components/offer-section";
import {
  useCategories,
  useProducts,
  usePromotions,
  useStoreSettings,
  useAllVariations,
} from "@/hooks/use-products";
import { ArrowRight, Truck, Globe, ShieldCheck, PackageCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/use-auth";
import { groupVariations, productFromPrice } from "@/lib/variants";

// Fallback icon shown for a category with no image_url set, keyed by exact
// category name (not position) so it actually matches what the category is.
// Unknown/new categories (e.g. added later via admin) fall back to a lantern.
const CATEGORY_EMOJI: Record<string, string> = {
  "Plum Wine": "🍶",
  Shochu: "🥃",
  Seaweed: "🌿",
  "Premium Beer": "🍺",
  Ingredient: "🧂",
  Miso: "🍲",
  Dessert: "🍡",
  Convenient: "🍱",
};
const categoryEmoji = (name: string) => CATEGORY_EMOJI[name] ?? "🏮";

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

function Home() {
  const { data: products = [], isLoading } = useProducts();
  const { data: categories = [] } = useCategories();
  const { data: promotions = [] } = usePromotions();
  const { data: settings } = useStoreSettings();
  const { data: variations = [] } = useAllVariations();
  const { user } = useAuth();
  const { t } = useI18n();
  const variationsByProduct = groupVariations(variations);
  // Featured section shows admin-marked products (products.featured), newest
  // first. Falls back to the newest products overall if none are marked yet.
  const featuredPool = products.some((p) => p.featured)
    ? products.filter((p) => p.featured)
    : products;
  const featured = [...featuredPool]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 8);
  const offerSections = promotions
    .map((promo) => ({ promo, items: products.filter((p) => p.promotion_id === promo.id) }))
    .filter((s) => s.items.length > 0);
  const shipThreshold = Number(settings?.free_shipping_threshold ?? 50);

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

      {/* Categories */}
      <section className="mx-auto max-w-6xl px-6">
        <div className="text-center mb-12">
          <h2 className="font-display font-semibold text-4xl md:text-5xl tracking-tight">
            {t("home.shopByCategory")}
          </h2>
          <p className="text-lg text-muted-foreground mt-3">{t("home.shopByCategorySub")}</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {categories.map((c) => (
            <Link
              key={c.id}
              to="/shop"
              search={{ category: c.slug }}
              className="group flex flex-col items-center justify-center text-center aspect-square rounded-3xl bg-muted p-5 transition-colors hover:bg-accent"
            >
              <div className="relative mb-4 size-24 overflow-hidden rounded-full bg-background grid place-items-center">
                {c.image_url ? (
                  <img
                    src={c.image_url}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <span className="text-4xl">{categoryEmoji(c.name)}</span>
                )}
              </div>
              <p className="font-display font-semibold text-base text-foreground">{c.name}</p>
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

      {/* Featured Products */}
      <section className="mx-auto max-w-6xl px-6">
        <div className="text-center mb-12">
          <h2 className="font-display font-semibold text-4xl md:text-5xl tracking-tight">
            {t("home.finestProducts")}
          </h2>
          <p className="text-lg text-muted-foreground mt-3">{t("home.premiumSelection")}</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {isLoading
            ? Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[4/5] rounded-2xl" />
              ))
            : featured.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  fromPrice={productFromPrice(p, variationsByProduct.get(p.id) ?? [])}
                />
              ))}
        </div>
        <div className="mt-12 text-center">
          <Link
            to="/shop"
            className="inline-flex items-center gap-1.5 text-base font-medium text-brand transition-all hover:gap-2.5"
          >
            {t("home.viewAll")} <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>

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
