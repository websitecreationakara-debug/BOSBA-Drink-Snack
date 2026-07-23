import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { CartItem, Product, ProductVariation } from "@/lib/types";

// A cart line is identified by product + chosen variation, so the same product
// in two weights is two distinct lines.
export const lineKey = (productId: string, variationId?: string | null) =>
  variationId ? `${productId}::${variationId}` : productId;

export const itemKey = (i: CartItem) => lineKey(i.product.id, i.variation?.id);

export const itemUnitPrice = (i: CartItem) =>
  i.variation
    ? (i.variation.sale_price ?? i.variation.price)
    : (i.product.sale_price ?? i.product.price);

type CartCtx = {
  items: CartItem[];
  count: number;
  subtotal: number;
  drawerOpen: boolean;
  setDrawerOpen: (b: boolean) => void;
  add: (p: Product, variation?: ProductVariation | null, qty?: number) => void;
  remove: (key: string) => void;
  setQty: (key: string, qty: number) => void;
  clear: () => void;
};

const Ctx = createContext<CartCtx | null>(null);

const STORAGE = "verdant_cart";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE);
      if (raw) setItems(JSON.parse(raw));
    } catch {
      // ignore malformed/absent cart in storage
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE, JSON.stringify(items));
  }, [items, hydrated]);

  const add: CartCtx["add"] = (p, variation = null, qty = 1) => {
    const key = lineKey(p.id, variation?.id);
    setItems((prev) => {
      const existing = prev.find((i) => itemKey(i) === key);
      if (existing) return prev.map((i) => (itemKey(i) === key ? { ...i, qty: i.qty + qty } : i));
      return [...prev, { product: p, variation, qty }];
    });
    setDrawerOpen(true);
  };

  const remove: CartCtx["remove"] = (key) =>
    setItems((prev) => prev.filter((i) => itemKey(i) !== key));
  const setQty: CartCtx["setQty"] = (key, qty) =>
    setItems((prev) =>
      qty <= 0
        ? prev.filter((i) => itemKey(i) !== key)
        : prev.map((i) => (itemKey(i) === key ? { ...i, qty } : i)),
    );
  const clear = () => setItems([]);

  const count = items.reduce((a, i) => a + i.qty, 0);
  const subtotal = items.reduce((a, i) => a + itemUnitPrice(i) * i.qty, 0);

  return (
    <Ctx.Provider
      value={{ items, count, subtotal, drawerOpen, setDrawerOpen, add, remove, setQty, clear }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart must be used within CartProvider");
  return c;
}
