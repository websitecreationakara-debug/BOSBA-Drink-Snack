import { useI18n, type I18nKey } from "@/lib/i18n";
import { productFromPrice } from "@/lib/variants";
import { ProductCard } from "./product-card";
import { HorizontalScroller } from "./horizontal-scroller";
import type { Product, ProductVariation, Promotion } from "@/lib/types";

export function SpecialOfferBanner({
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
    <section className="mx-auto max-w-7xl px-4 md:px-6">
      <div className="lantern-glow relative overflow-hidden rounded-2xl bg-brand md:rounded-3xl">
        <div className="flex flex-col lg:flex-row lg:items-stretch">
          <div className="flex shrink-0 flex-col justify-center p-6 text-brand-foreground md:p-8 lg:w-72">
            <span className="text-[11px] font-bold uppercase tracking-widest text-brand-foreground/80">
              {kindLabel}
            </span>
            <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight md:text-3xl">
              {promotion.name}
            </h2>
            {promotion.description && (
              <p className="mt-2 text-sm text-brand-foreground/80">{promotion.description}</p>
            )}
          </div>

          <HorizontalScroller
            className="flex-1"
            scrollClassName="flex gap-4 p-4 md:p-6"
            edgeFromClassName="from-brand"
          >
            {items.map((p) => (
              <div key={p.id} className="w-48 shrink-0 md:w-56">
                <ProductCard
                  product={p}
                  fromPrice={productFromPrice(p, variationsByProduct.get(p.id) ?? [])}
                  offerLabel={kindLabel}
                />
              </div>
            ))}
          </HorizontalScroller>
        </div>
      </div>
    </section>
  );
}
