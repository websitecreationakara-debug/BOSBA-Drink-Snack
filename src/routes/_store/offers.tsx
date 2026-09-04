import { createFileRoute } from "@tanstack/react-router";
import { useProducts, usePromotions, useAllVariations } from "@/hooks/use-products";
import { OfferSection } from "@/components/marketing/offer-section";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";
import { groupVariations } from "@/lib/commerce/variants";

export const Route = createFileRoute("/_store/offers")({
  head: () => ({
    meta: [
      { title: "Offers — BOSBA Drink Snack" },
      {
        name: "description",
        content: "Limited-time offers and seasonal deals on Japanese drinks and snacks.",
      },
      { property: "og:url", content: "https://bosbadrinksnack.com/offers" },
    ],
    links: [{ rel: "canonical", href: "https://bosbadrinksnack.com/offers" }],
  }),
  component: Offers,
});

function Offers() {
  const { data: promotions = [], isLoading } = usePromotions();
  const { data: products = [] } = useProducts();
  const { data: variations = [] } = useAllVariations();
  const { t } = useI18n();
  const variationsByProduct = groupVariations(variations);

  const sections = promotions
    .map((promo) => ({ promo, items: products.filter((p) => p.promotion_id === promo.id) }))
    .filter((s) => s.items.length > 0);

  return (
    <div className="mx-auto max-w-7xl px-4 md:px-6 py-8 md:py-10">
      <div className="mb-8 md:mb-12">
        <h1 className="font-display font-semibold tracking-tight text-3xl md:text-5xl">
          {t("offers.title")}
        </h1>
        <p className="text-muted-foreground mt-2">{t("offers.subtitle")}</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[4/5] rounded-2xl" />
          ))}
        </div>
      ) : sections.length === 0 ? (
        <div className="text-center py-20 rounded-3xl bg-muted">
          <p className="font-display font-semibold text-xl">{t("offers.empty")}</p>
        </div>
      ) : (
        <div className="space-y-16">
          {sections.map(({ promo, items }) => (
            <OfferSection
              key={promo.id}
              promotion={promo}
              products={items}
              variationsByProduct={variationsByProduct}
            />
          ))}
        </div>
      )}
    </div>
  );
}
