import { Link } from "@tanstack/react-router";
import { ShoppingBag, SlidersHorizontal, Heart } from "lucide-react";
import { useCart } from "@/hooks/use-cart";
import { useWishlist } from "@/hooks/use-wishlist";
import { useI18n } from "@/lib/i18n";
import { slugify } from "@/lib/utils";
import type { Product } from "@/lib/types";

export function ProductCard({
  product,
  fromPrice,
  offerLabel,
}: {
  product: Product;
  fromPrice?: number;
  offerLabel?: string;
}) {
  const { add } = useCart();
  const { has: inWishlist, toggle: toggleWishlist } = useWishlist();
  const { t } = useI18n();
  const saved = inWishlist(product.id);
  // Variable products can't be added from the grid — the customer must pick a
  // weight, so the card leads with "from $X" and links through to the page.
  const variable = product.type === "variable";
  // Simple products track their own stock; 0 = out of stock. Variable products
  // carry stock on their variations, so the grid card never blocks them here.
  const soldOut = !variable && product.stock === 0;
  const hasSale = product.sale_price != null && product.sale_price < product.price;
  const discount = hasSale
    ? Math.round(((product.price - product.sale_price!) / product.price) * 100)
    : 0;

  return (
    <Link
      to="/product/$id"
      params={{ id: slugify(product.title) || product.id }}
      className="group flex flex-col rounded-3xl bg-muted p-3 transition-colors hover:bg-accent"
    >
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-background">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-xs text-muted-foreground">
            {t("product.noImage")}
          </div>
        )}
        {(offerLabel || hasSale || soldOut) && (
          <div className="absolute left-2.5 top-2.5 flex flex-col items-start gap-1">
            {soldOut && (
              <span className="rounded-full bg-foreground/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-background">
                Sold out
              </span>
            )}
            {offerLabel && !soldOut && (
              <span className="rounded-full bg-foreground/85 px-2 py-0.5 text-[10px] font-bold tracking-wide text-background">
                {offerLabel}
              </span>
            )}
            {hasSale && !soldOut && (
              <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold tracking-wide text-brand-foreground">
                -{discount}%
              </span>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleWishlist(product.id);
          }}
          aria-pressed={saved}
          aria-label={saved ? "Remove from wishlist" : "Save to wishlist"}
          className="absolute right-2.5 top-2.5 grid size-8 place-items-center rounded-full bg-background/70 text-foreground backdrop-blur transition-colors hover:text-brand"
        >
          <Heart className={`size-4 ${saved ? "fill-brand text-brand" : ""}`} />
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-3 px-2 pb-1 pt-4">
        <h3 className="line-clamp-1 text-[17px] font-medium leading-tight text-foreground">
          {product.title}
        </h3>

        <div className="mt-auto flex items-end justify-between gap-2">
          <div className="flex items-baseline gap-1.5">
            {variable ? (
              <span className="text-[15px] font-medium text-brand">
                {t("product.from")} ${(fromPrice ?? product.price).toFixed(2)}
              </span>
            ) : (
              <>
                <span className="text-[15px] font-medium text-brand">
                  ${(product.sale_price ?? product.price).toFixed(2)}
                </span>
                {product.weight && (
                  <span className="text-xs text-muted-foreground">/ {product.weight}</span>
                )}
                {hasSale && (
                  <span className="text-xs text-muted-foreground line-through">
                    ${product.price.toFixed(2)}
                  </span>
                )}
              </>
            )}
          </div>

          {variable ? (
            <span
              aria-label={t("product.selectOptions")}
              className="grid size-9 shrink-0 place-items-center rounded-full border border-brand bg-background text-brand transition-colors group-hover:bg-brand group-hover:text-brand-foreground"
            >
              <SlidersHorizontal className="size-4" />
            </span>
          ) : (
            <button
              disabled={soldOut}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                add(product);
              }}
              aria-label={t("product.addToCart")}
              className="grid size-9 shrink-0 place-items-center rounded-full border border-brand bg-background text-brand transition-colors hover:bg-brand hover:text-brand-foreground disabled:opacity-40 disabled:pointer-events-none"
            >
              <ShoppingBag className="size-4" />
            </button>
          )}
        </div>
      </div>
    </Link>
  );
}
