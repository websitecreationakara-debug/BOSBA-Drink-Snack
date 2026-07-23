import { ProductCard } from "./product-card";
import { useI18n, type I18nKey } from "@/lib/i18n";
import { productFromPrice } from "@/lib/variants";
import type { Product, ProductVariation, Promotion } from "@/lib/types";

export function OfferSection({
  promotion,
  products,
  variationsByProduct,
  limit,
}: {
  promotion: Promotion;
  products: Product[];
  variationsByProduct: Map<string, ProductVariation[]>;
  limit?: number;
}) {
  const { t } = useI18n();
  if (products.length === 0) return null;
  const kindLabel = t(`offer.kind.${promotion.kind}` as I18nKey);
  const items = limit ? products.slice(0, limit) : products;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-brand">
              {kindLabel}
            </span>
            {promotion.discount_pct ? (
              <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-bold text-brand">
                -{promotion.discount_pct}%
              </span>
            ) : null}
          </div>
          <h2 className="font-display font-semibold text-2xl md:text-3xl tracking-tight mt-1">
            {promotion.name}
          </h2>
          {promotion.description && (
            <p className="text-muted-foreground mt-1 max-w-2xl">{promotion.description}</p>
          )}
        </div>
        {promotion.ends_at && (
          <span className="text-sm font-medium text-muted-foreground">
            {t("offers.ends", { date: new Date(promotion.ends_at).toLocaleDateString() })}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
        {items.map((p) => (
          <ProductCard
            key={p.id}
            product={p}
            fromPrice={productFromPrice(p, variationsByProduct.get(p.id) ?? [])}
            offerLabel={kindLabel}
          />
        ))}
      </div>
    </section>
  );
}
