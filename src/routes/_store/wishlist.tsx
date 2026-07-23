import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { ProductCard } from "@/components/product-card";
import { useWishlist } from "@/hooks/use-wishlist";
import { useProducts, useAllVariations } from "@/hooks/use-products";
import { groupVariations, productFromPrice } from "@/lib/variants";

export const Route = createFileRoute("/_store/wishlist")({ component: Wishlist });

function Wishlist() {
  const { ids } = useWishlist();
  const { data: products = [] } = useProducts();
  const { data: variations = [] } = useAllVariations();
  const variationsByProduct = groupVariations(variations);

  // Preserve the order items were saved in.
  const saved = ids
    .map((id) => products.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => p != null);

  if (saved.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
        <div className="size-20 rounded-full bg-muted grid place-items-center mx-auto mb-6">
          <Heart className="size-8 text-muted-foreground" />
        </div>
        <h1 className="font-display font-semibold tracking-tight text-3xl">
          Your wishlist is empty
        </h1>
        <p className="text-muted-foreground mt-2">Save items you love for later.</p>
        <Link
          to="/shop"
          className="inline-flex mt-6 items-center gap-2 rounded-full bg-brand text-brand-foreground px-6 py-3 text-sm font-semibold hover:bg-secondary-accent transition-colors"
        >
          Browse the shop
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 md:px-6 py-8 md:py-12">
      <div className="mb-8">
        <h1 className="font-display font-semibold tracking-tight text-3xl md:text-4xl">Wishlist</h1>
        <p className="text-muted-foreground mt-1">
          {saved.length} {saved.length === 1 ? "item" : "items"} saved
        </p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {saved.map((p) => (
          <ProductCard
            key={p.id}
            product={p}
            fromPrice={productFromPrice(p, variationsByProduct.get(p.id) ?? [])}
          />
        ))}
      </div>
    </div>
  );
}
