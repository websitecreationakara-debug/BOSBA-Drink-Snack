import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  useStoreSettings,
  useProductVariations,
  useProductImages,
  useProducts,
  useAllVariations,
} from "@/hooks/use-products";
import { getProduct } from "@/data/products";
import type { Product } from "@/lib/types";
import { useCart } from "@/hooks/use-cart";
import { useWishlist } from "@/hooks/use-wishlist";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/product-card";
import { productFromPrice, groupVariations } from "@/lib/variants";
import { Star, ShoppingBag, Minus, Plus, ArrowLeft, Truck, Heart } from "lucide-react";
import { cn, slugify } from "@/lib/utils";

const RELATED_COUNT = 4;

// Same-category products first (excluding this one), backfilled with other
// published products so the row is never sparse. Selection is client-side off
// the already-cached catalog — no extra fetch in practice.
function relatedProducts(current: Product, all: Product[]): Product[] {
  const pool = all.filter((p) => p.id !== current.id);
  const sameCat = current.category_id
    ? pool.filter((p) => p.category_id === current.category_id)
    : [];
  const rest = pool.filter((p) => !sameCat.includes(p));
  return [...sameCat, ...rest].slice(0, RELATED_COUNT);
}

const SITE = "https://bosbapremiumfoods.com";

const metaDescription = (p: Product) =>
  (p.description?.trim() || `${p.title} — premium quality foods from BOSBA Premium Foods.`)
    .replace(/\s+/g, " ")
    .slice(0, 160);

export const Route = createFileRoute("/_store/product/$id")({
  loader: ({ params }) => getProduct({ data: { id: params.id } }) as Promise<Product | null>,
  head: ({ loaderData: product, params }) => {
    const url = `${SITE}/product/${product ? slugify(product.title) || product.id : params.id}`;
    if (!product) {
      return {
        meta: [
          { title: "Product not found — BOSBA Premium Foods" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const desc = metaDescription(product);
    const img = product.image_url ?? undefined;
    return {
      meta: [
        { title: `${product.title} — BOSBA Premium Foods` },
        { name: "description", content: desc },
        { property: "og:title", content: product.title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "product" },
        { property: "og:url", content: url },
        ...(img
          ? [
              { property: "og:image", content: img },
              { name: "twitter:image", content: img },
            ]
          : []),
        { name: "twitter:title", content: product.title },
        { name: "twitter:description", content: desc },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: ProductDetail,
});

function ProductJsonLd({ product }: { product: Product }) {
  const price = product.sale_price ?? product.price;
  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    image: product.image_url ?? undefined,
    description: product.description ?? undefined,
    brand: { "@type": "Brand", name: "BOSBA Premium Foods" },
  };
  if (price > 0) {
    ld.offers = {
      "@type": "Offer",
      priceCurrency: "USD",
      price: price.toFixed(2),
      availability:
        product.stock === 0 ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
      url: `${SITE}/product/${slugify(product.title) || product.id}`,
    };
  }
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
  );
}

function ProductDetail() {
  const product = Route.useLoaderData();
  const { data: variations = [] } = useProductVariations(product?.id ?? "");
  const { data: galleryImages = [] } = useProductImages(product?.id ?? "");
  const { data: allProducts = [] } = useProducts();
  const { data: allVariations = [] } = useAllVariations();
  const { data: settings } = useStoreSettings();
  const { add } = useCart();
  const { has: inWishlist, toggle: toggleWishlist } = useWishlist();
  const [qty, setQty] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Which gallery photo is enlarged; null = the cover image.
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const shipThreshold = Number(settings?.free_shipping_threshold ?? 50);

  const variable = product?.type === "variable";
  // Default to the first (cheapest) variation until the customer picks one.
  const selected = variations.find((v) => v.id === selectedId) ?? variations[0] ?? null;

  if (!product) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="font-display font-bold text-2xl">Product not found</h1>
        <p className="text-muted-foreground mt-2">It may have been removed or is unavailable.</p>
        <Link
          to="/shop"
          className="inline-flex mt-6 items-center gap-2 rounded-full bg-brand text-brand-foreground px-6 py-3 text-sm font-bold"
        >
          <ArrowLeft className="size-4" /> Back to shop
        </Link>
      </div>
    );
  }

  // Price/stock/weight come from the chosen variation for variable products,
  // otherwise from the product itself.
  const basePrice = variable ? (selected?.price ?? 0) : product.price;
  const salePrice = variable ? (selected?.sale_price ?? null) : product.sale_price;
  // null = untracked (always available); 0 = out of stock; >0 = tracked count.
  const activeStock = variable ? (selected?.stock ?? null) : product.stock;
  const soldOut = activeStock === 0;
  const weightLabel = variable ? selected?.weight : product.weight;
  const pcs = variable ? (selected?.pcs ?? null) : product.pcs;
  const hasSale = salePrice != null && salePrice < basePrice;
  const price = salePrice ?? basePrice;
  const discount = hasSale ? Math.round(((basePrice - salePrice!) / basePrice) * 100) : 0;
  const addDisabled = (variable && !selected) || soldOut;

  const related = relatedProducts(product, allProducts);
  const variationsByProduct = groupVariations(allVariations);

  // Cover first, then gallery photos; clicking a thumbnail swaps the big image.
  const images = [product.image_url, ...galleryImages.map((g) => g.url)].filter(
    (u): u is string => !!u,
  );
  const mainImage = activeImage && images.includes(activeImage) ? activeImage : images[0];

  return (
    <div className="mx-auto max-w-6xl px-4 md:px-6 py-8 md:py-10">
      <ProductJsonLd product={product} />
      <Link
        to="/shop"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="size-4" /> Back to shop
      </Link>

      <div className="grid md:grid-cols-2 gap-6 md:gap-10">
        <div>
          <div className="relative aspect-square rounded-3xl overflow-hidden bg-muted">
            {mainImage ? (
              <img src={mainImage} alt={product.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full grid place-items-center text-muted-foreground text-sm">
                No image
              </div>
            )}
            <div className="absolute top-4 left-4 flex flex-col gap-1.5">
              {hasSale && (
                <span className="px-2.5 py-1 bg-destructive text-destructive-foreground text-[10px] font-bold uppercase tracking-wider rounded-md">
                  -{discount}%
                </span>
              )}
              {product.badge && (
                <span
                  className={cn(
                    "px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md",
                    product.badge === "HOT" && "bg-warning text-foreground",
                    product.badge === "NEW" && "bg-accent text-accent-foreground",
                    product.badge === "ORGANIC" && "bg-brand text-brand-foreground",
                    product.badge === "SALE" && "bg-destructive text-destructive-foreground",
                  )}
                >
                  {product.badge}
                </span>
              )}
            </div>
          </div>
          {images.length > 1 && (
            <div className="mt-3 grid grid-cols-4 gap-3">
              {images.map((url) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => setActiveImage(url)}
                  aria-label="View product photo"
                  aria-pressed={url === mainImage}
                  className={cn(
                    "aspect-square rounded-xl overflow-hidden bg-muted border-2 transition-colors",
                    url === mainImage ? "border-brand" : "border-transparent hover:border-brand/50",
                  )}
                >
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col">
          <h1 className="font-display font-semibold tracking-tight text-3xl md:text-4xl leading-tight">
            {product.title}
          </h1>

          <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Star className="size-4 fill-warning text-warning" />
              {product.rating ?? 4.5}
            </span>
            <span className="opacity-50">·</span>
            {soldOut ? (
              <span className="text-destructive font-medium">Out of stock</span>
            ) : (
              <span className="text-success font-medium">
                {activeStock != null ? `In stock (${activeStock})` : "In stock"}
              </span>
            )}
            {weightLabel && (
              <>
                <span className="opacity-50">·</span>
                <span>{weightLabel}</span>
              </>
            )}
            {pcs != null && (
              <>
                <span className="opacity-50">·</span>
                <span>{pcs} pcs/box</span>
              </>
            )}
          </div>

          <div className="flex items-baseline gap-3 mt-5">
            <span className="font-display font-bold text-3xl text-brand">${price.toFixed(2)}</span>
            {hasSale && (
              <span className="text-lg text-muted-foreground line-through">
                ${basePrice.toFixed(2)}
              </span>
            )}
          </div>

          {variable && variations.length > 0 && (
            <div className="mt-6">
              <span className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                Weight
              </span>
              <div className="flex flex-wrap gap-2">
                {variations.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(v.id);
                      setQty(1);
                    }}
                    className={cn(
                      "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                      v.id === selected?.id
                        ? "border-brand bg-brand text-brand-foreground"
                        : "hover:border-brand",
                    )}
                  >
                    {v.weight}
                  </button>
                ))}
              </div>
            </div>
          )}

          {product.description && (
            <p className="text-muted-foreground mt-5 leading-relaxed">{product.description}</p>
          )}

          <div className="flex items-center gap-3 mt-8">
            <div className="flex items-center border rounded-full">
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="size-10 grid place-items-center text-muted-foreground hover:text-foreground disabled:opacity-40"
                disabled={qty <= 1}
                aria-label="Decrease quantity"
              >
                <Minus className="size-4" />
              </button>
              <span className="w-10 text-center font-bold">{qty}</span>
              <button
                type="button"
                onClick={() => setQty((q) => Math.min(activeStock ?? 99, q + 1))}
                className="size-10 grid place-items-center text-muted-foreground hover:text-foreground"
                aria-label="Increase quantity"
              >
                <Plus className="size-4" />
              </button>
            </div>
            <Button
              size="lg"
              disabled={addDisabled}
              onClick={() => add(product, variable ? selected : null, qty)}
              className="flex-1 rounded-full font-bold"
            >
              <ShoppingBag className="size-4 mr-2" />
              {soldOut ? "Out of Stock" : "Add to Cart"}
            </Button>
            <button
              type="button"
              onClick={() => toggleWishlist(product.id)}
              aria-pressed={inWishlist(product.id)}
              aria-label={inWishlist(product.id) ? "Remove from wishlist" : "Save to wishlist"}
              className="grid size-12 shrink-0 place-items-center rounded-full border transition-colors hover:bg-muted"
            >
              <Heart
                className={cn(
                  "size-5 transition-colors",
                  inWishlist(product.id) && "fill-brand text-brand",
                )}
              />
            </button>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-6 border-t pt-6">
            <Truck className="size-4 text-brand" />
            {`Free chilled delivery on orders over $${shipThreshold}.`}
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-16 md:mt-20">
          <h2 className="font-display font-semibold tracking-tight text-2xl md:text-3xl mb-6">
            You might also like
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {related.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                fromPrice={productFromPrice(p, variationsByProduct.get(p.id) ?? [])}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
