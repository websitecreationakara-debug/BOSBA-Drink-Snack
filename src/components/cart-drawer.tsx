import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useCart, itemKey, itemUnitPrice } from "@/hooks/use-cart";
import { useStoreSettings } from "@/hooks/use-products";
import { Button } from "@/components/ui/button";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Link } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";

export function CartDrawer() {
  const { items, drawerOpen, setDrawerOpen, setQty, remove, subtotal } = useCart();
  const { data: settings } = useStoreSettings();
  const { t } = useI18n();
  const threshold = settings?.free_shipping_threshold ?? 50;
  const progress = Math.min((subtotal / Number(threshold)) * 100, 100);
  const remaining = Math.max(Number(threshold) - subtotal, 0);
  // The amount is styled mid-sentence, so split the template around its
  // placeholder rather than interpolating — this keeps the word order each
  // language actually uses (the amount leads the phrase in Japanese).
  const [hintBefore, hintAfter] = t("cart.freeDeliveryHint").split("{amount}");

  return (
    <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
      <SheetContent className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="px-6 py-5 border-b">
          <SheetTitle className="font-display text-xl">
            {t("cart.title", { n: items.length })}
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-4">
            <div className="size-20 rounded-full bg-muted grid place-items-center">
              <ShoppingBag className="size-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-display font-semibold text-lg">{t("cart.empty")}</p>
              <p className="text-sm text-muted-foreground mt-1">{t("cart.emptySub")}</p>
            </div>
            <Button onClick={() => setDrawerOpen(false)} asChild>
              <Link to="/shop">{t("cart.returnToShop")}</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="px-6 py-4 space-y-2 border-b bg-muted">
              <p className="text-xs font-medium">
                {remaining > 0 ? (
                  <>
                    {hintBefore}
                    <span className="font-bold text-brand">${remaining.toFixed(2)}</span>
                    {hintAfter}
                  </>
                ) : (
                  <span className="text-brand font-bold">{t("cart.freeDeliveryUnlocked")}</span>
                )}
              </p>
              <Progress value={progress} className="h-1.5" />
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {items.map((item) => {
                const { product, variation, qty } = item;
                const key = itemKey(item);
                const unit = itemUnitPrice(item);
                return (
                  <div key={key} className="flex gap-3">
                    <div className="size-20 rounded-xl bg-muted overflow-hidden shrink-0">
                      {product.image_url && (
                        <img
                          src={product.image_url}
                          alt={product.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-sm leading-tight">
                          {product.title}
                          {variation && (
                            <span className="text-muted-foreground">
                              {" "}
                              ·{" "}
                              {variation.flavor
                                ? `${variation.flavor}, ${variation.weight}`
                                : variation.weight}
                            </span>
                          )}
                        </p>
                        <button
                          onClick={() => remove(key)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t("cart.each", { price: `$${unit.toFixed(2)}` })}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-1 border rounded-full">
                          <button
                            onClick={() => setQty(key, qty - 1)}
                            className="size-7 grid place-items-center hover:bg-muted rounded-full"
                          >
                            <Minus className="size-3" />
                          </button>
                          <span className="text-xs font-semibold w-6 text-center">{qty}</span>
                          <button
                            onClick={() => setQty(key, qty + 1)}
                            className="size-7 grid place-items-center hover:bg-muted rounded-full"
                          >
                            <Plus className="size-3" />
                          </button>
                        </div>
                        <span className="font-bold text-sm">${(unit * qty).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t px-6 py-5 space-y-4 bg-card">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("cart.subtotal")}</span>
                <span className="font-display font-semibold text-lg">${subtotal.toFixed(2)}</span>
              </div>
              <Button
                size="lg"
                className="w-full rounded-full"
                onClick={() => setDrawerOpen(false)}
                asChild
              >
                <Link to="/checkout">{t("cart.checkout")}</Link>
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
