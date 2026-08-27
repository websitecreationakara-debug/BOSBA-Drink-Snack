import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  useStoreSettings,
  useProductVariations,
  useProductImages,
  useProducts,
  useAllVariations,
} from "@/hooks/use-products";
import { getProduct } from "@/data/products";
import { renderFormattedDescription } from "@/lib/format-description";
import type { Product } from "@/lib/types";
import { useCart } from "@/hooks/use-cart";
import { useWishlist } from "@/hooks/use-wishlist";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/product-card";
import { productFromPrice, groupVariations, hasValidPrice } from "@/lib/variants";
import {
  Star,
  ShoppingBag,
  Minus,
  Plus,
  ArrowLeft,
  Truck,
  Heart,
  Play,
  MessageCircle,
} from "lucide-react";
import { cn, slugify } from "@/lib/utils";
import { PIXEL_CURRENCY, trackPixel } from "@/lib/meta-pixel";
import { preOrderChatUrl } from "@/lib/sales-chat";
import { extractYoutubeId, youtubeThumbnail, youtubeEmbedSrc } from "@/lib/youtube";
import { useI18n } from "@/lib/i18n";

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

const SITE = "https://bosbadrinksnack.com";

const metaDescription = (p: Product) =>
  (p.description?.trim() || `${p.title} — premium quality foods from BOSBA Drink Snack.`)
    .replace(/\s+/g, " ")
    .slice(0, 160);

export const Route = createFileRoute("/_store/product/$id")({
  loader: ({ params }) => getProduct({ data: { id: params.id } }) as Promise<Product | null>,
  head: ({ loaderData: product, params }) => {
    const url = `${SITE}/product/${product ? slugify(product.title) || product.id : params.id}`;
    if (!product) {
      return {
        meta: [
          { title: "Product not found — BOSBA Drink Snack" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const desc = metaDescription(product);
    const img = product.image_url ?? undefined;
    return {
      meta: [
        { title: `${product.title} — BOSBA Drink Snack` },
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
    brand: { "@type": "Brand", name: "BOSBA Drink Snack" },
  };
  if (price > 0) {
    ld.offers = {
      "@type": "Offer",
      priceCurrency: "USD",
      price: price.toFixed(2),
      availability: product.pre_order
        ? "https://schema.org/PreOrder"
        : product.stock === 0
          ? "https://schema.org/OutOfStock"
          : "https://schema.org/InStock",
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
  const { t } = useI18n();
  const [qty, setQty] = useState(1);
  const [selectedFlavor, setSelectedFlavor] = useState<string | null>(null);
  const [selectedWeight, setSelectedWeight] = useState<string | null>(null);
  // Which gallery photo is enlarged; null = the cover image.
  const [activeImage, setActiveImage] = useState<string | null>(null);
  // True when the video thumbnail is selected instead of a photo.
  const [showVideo, setShowVideo] = useState(false);
  // "Read more" only appears once the description actually overflows 3 lines —
  // re-measured on resize since line-wrapping depends on the viewport width.
  const descRef = useRef<HTMLParagraphElement>(null);
  const [descExpanded, setDescExpanded] = useState(false);
  const [descOverflows, setDescOverflows] = useState(false);
  useEffect(() => {
    const el = descRef.current;
    if (!el) return;
    const check = () => setDescOverflows(el.scrollHeight > el.clientHeight + 1);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [product?.description]);

  // Meta Pixel: one ViewContent per product viewed.
  useEffect(() => {
    if (!product) return;
    trackPixel("ViewContent", {
      content_ids: [product.id],
      content_name: product.title,
      content_type: "product",
      value: Number((product.sale_price ?? product.price ?? 0).toFixed(2)),
      currency: PIXEL_CURRENCY,
    });
  }, [product]);

  const shipThreshold = Number(settings?.free_shipping_threshold ?? 50);

  const variable = product?.type === "variable";
  // Some variable products carry a second attribute (flavor) alongside their
  // weight/size — only show a flavor selector when at least one variation
  // actually has one set, so every weight-only product behaves exactly as
  // before.
  const hasFlavorAxis = variations.some((v) => v.flavor);
  const flavors = hasFlavorAxis
    ? [...new Set(variations.map((v) => v.flavor).filter((f): f is string => !!f))]
    : [];
  const effectiveFlavor = hasFlavorAxis ? (selectedFlavor ?? flavors[0] ?? null) : null;
  const weightOptions = [
    ...new Set(
      variations.filter((v) => !hasFlavorAxis || v.flavor === effectiveFlavor).map((v) => v.weight),
    ),
  ];
  // Weight selection stays put across a flavor switch (most products offer
  // the same sizes for every flavor) — only fall back to this flavor's first
  // size if the previously picked one isn't actually offered for it.
  const effectiveWeight =
    selectedWeight && weightOptions.includes(selectedWeight)
      ? selectedWeight
      : (weightOptions[0] ?? null);
  // Default to the first (cheapest) variation until the customer picks one.
  const selected =
    variations.find(
      (v) => (!hasFlavorAxis || v.flavor === effectiveFlavor) && v.weight === effectiveWeight,
    ) ??
    variations.find(hasValidPrice) ??
    variations[0] ??
    null;

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
  const preOrder = product.pre_order;
  const soldOut = activeStock === 0 && !preOrder;
  const weightLabel = variable ? selected?.weight : product.weight;
  const flavorLabel = variable ? selected?.flavor : null;
  const pcs = variable ? (selected?.pcs ?? null) : product.pcs;
  const hasSale = salePrice != null && salePrice < basePrice;
  const price = salePrice ?? basePrice;
  const discount = hasSale ? Math.round(((basePrice - salePrice!) / basePrice) * 100) : 0;
  // A variation the admin added but never priced (0, no Sale Price) — block
  // the sale rather than let it check out for free.
  const unpriced = variable && (!selected || !hasValidPrice(selected));
  const addDisabled = (variable && !selected) || soldOut || unpriced;

  const related = relatedProducts(product, allProducts);
  const variationsByProduct = groupVariations(allVariations);

  // Cover first, then gallery photos; clicking a thumbnail swaps the big image.
  // Sizes often look visibly different (e.g. a 1.8L vs 720ml bottle), so a
  // variation with its own photo overrides the product's default cover.
  const coverImage = (variable && selected?.image_url) || product.image_url;
  const images = [coverImage, ...galleryImages.map((g) => g.url)].filter((u): u is string => !!u);
  const mainImage = activeImage && images.includes(activeImage) ? activeImage : images[0];
  const videoId = product.video_url ? extractYoutubeId(product.video_url) : null;

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
            {showVideo && videoId ? (
              <iframe
                key={videoId}
                src={youtubeEmbedSrc(videoId)}
                title={product.title}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : mainImage ? (
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
          {(images.length > 1 || videoId) && (
            <div className="mt-3 grid grid-cols-4 gap-2 sm:gap-3">
              {videoId && (
                <button
                  type="button"
                  onClick={() => {
                    setShowVideo(true);
                  }}
                  aria-label="Play product video"
                  aria-pressed={showVideo}
                  className={cn(
                    "relative aspect-square rounded-xl overflow-hidden bg-muted border-2 transition-colors",
                    showVideo ? "border-brand" : "border-transparent hover:border-brand/50",
                  )}
                >
                  <img
                    src={youtubeThumbnail(videoId)}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute inset-0 grid place-items-center bg-black/30">
                    <Play className="size-6 text-white fill-white" />
                  </span>
                </button>
              )}
              {images.map((url) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => {
                    setActiveImage(url);
                    setShowVideo(false);
                  }}
                  aria-label="View product photo"
                  aria-pressed={!showVideo && url === mainImage}
                  className={cn(
                    "aspect-square rounded-xl overflow-hidden bg-muted border-2 transition-colors",
                    !showVideo && url === mainImage
                      ? "border-brand"
                      : "border-transparent hover:border-brand/50",
                  )}
                >
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col">
          <h1 className="font-display font-semibold tracking-tight text-2xl sm:text-3xl md:text-4xl leading-tight">
            {product.title}
          </h1>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Star className="size-4 fill-warning text-warning" />
              {product.rating ?? 4.5}
            </span>
            <span className="opacity-50">·</span>
            {preOrder ? (
              <span className="text-brand font-medium">Available for Pre-Order</span>
            ) : soldOut ? (
              <span className="text-destructive font-medium">Out of stock</span>
            ) : (
              <span className="text-success font-medium">
                {activeStock != null ? `In stock (${activeStock})` : "In stock"}
              </span>
            )}
            {flavorLabel && (
              <>
                <span className="opacity-50">·</span>
                <span>{flavorLabel}</span>
              </>
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
            <span className="font-display font-bold text-3xl text-brand">
              {unpriced ? "Price unavailable" : `$${price.toFixed(2)}`}
            </span>
            {hasSale && (
              <span className="text-lg text-muted-foreground line-through">
                ${basePrice.toFixed(2)}
              </span>
            )}
          </div>

          {hasFlavorAxis && (
            <div className="mt-6">
              <span className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                Flavor
              </span>
              <div className="flex flex-wrap gap-2">
                {flavors.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => {
                      setSelectedFlavor(f);
                      setQty(1);
                      setActiveImage(null);
                    }}
                    className={cn(
                      "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                      f === effectiveFlavor
                        ? "border-brand bg-brand text-brand-foreground"
                        : "hover:border-brand",
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          )}

          {variable && weightOptions.length > 0 && (
            <div className="mt-6">
              <span className="block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                Weight
              </span>
              <div className="flex flex-wrap gap-2">
                {weightOptions.map((w) => {
                  const wv = variations.find(
                    (v) => (!hasFlavorAxis || v.flavor === effectiveFlavor) && v.weight === w,
                  );
                  const wUnpriced = wv != null && !hasValidPrice(wv);
                  return (
                    <button
                      key={w}
                      type="button"
                      onClick={() => {
                        setSelectedWeight(w);
                        setQty(1);
                        setActiveImage(null);
                      }}
                      className={cn(
                        "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                        w === effectiveWeight
                          ? "border-brand bg-brand text-brand-foreground"
                          : "hover:border-brand",
                        wUnpriced && "opacity-40",
                      )}
                    >
                      {w}
                      {wUnpriced && " (unavailable)"}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {product.description && (
            <div className="mt-5">
              <p
                ref={descRef}
                className={cn(
                  "text-muted-foreground leading-relaxed whitespace-pre-line",
                  !descExpanded && "line-clamp-3",
                )}
              >
                {renderFormattedDescription(product.description)}
              </p>
              {(descOverflows || descExpanded) && (
                <button
                  type="button"
                  onClick={() => setDescExpanded((v) => !v)}
                  className="text-sm font-bold text-brand mt-1 hover:underline"
                >
                  {descExpanded ? "Read less" : "Read more"}
                </button>
              )}
            </div>
          )}

          {/* Narrow phones can't fit stepper + button + wishlist on one line, so
              the button drops to its own full-width row below them. */}
          <div className="flex flex-wrap items-center gap-3 mt-8">
            {!preOrder && (
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
            )}
            {preOrder ? (
              <Button
                asChild
                size="lg"
                className="order-last w-full sm:order-0 sm:w-auto sm:flex-1 rounded-full font-bold"
              >
                <a
                  href={preOrderChatUrl(
                    product.title,
                    flavorLabel && weightLabel
                      ? `${flavorLabel} · ${weightLabel}`
                      : (flavorLabel ?? weightLabel),
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle className="size-4 mr-2" />
                  Chat to Pre-Order
                </a>
              </Button>
            ) : (
              <Button
                size="lg"
                disabled={addDisabled}
                onClick={() => add(product, variable ? selected : null, qty)}
                className="order-last w-full sm:order-0 sm:w-auto sm:flex-1 rounded-full font-bold"
              >
                <ShoppingBag className="size-4 mr-2" />
                {soldOut ? "Out of Stock" : unpriced ? "Unavailable" : "Add to Cart"}
              </Button>
            )}
            <button
              type="button"
              onClick={() => toggleWishlist(product.id)}
              aria-pressed={inWishlist(product.id)}
              aria-label={inWishlist(product.id) ? "Remove from wishlist" : "Save to wishlist"}
              className="grid size-12 shrink-0 place-items-center rounded-full border transition-colors hover:bg-muted ml-auto sm:ml-0"
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
            {t("product.freeDelivery", { threshold: shipThreshold })}
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-16 md:mt-20">
          <h2 className="font-display font-semibold tracking-tight text-2xl md:text-3xl mb-6">
            {t("product.youMightAlsoLike")}
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
