import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

// The wishlist stores only product ids; the product data is looked up from the
// catalog when rendering, so saved items always reflect current price/stock.
type WishlistCtx = {
  ids: string[];
  count: number;
  has: (id: string) => boolean;
  toggle: (id: string) => void;
  remove: (id: string) => void;
  clear: () => void;
};

const Ctx = createContext<WishlistCtx | null>(null);

const STORAGE = "bosba_wishlist";

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE);
      if (raw) setIds(JSON.parse(raw));
    } catch {
      // ignore malformed/absent wishlist in storage
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE, JSON.stringify(ids));
  }, [ids, hydrated]);

  const has = (id: string) => ids.includes(id);
  const toggle = (id: string) =>
    setIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const remove = (id: string) => setIds((prev) => prev.filter((x) => x !== id));
  const clear = () => setIds([]);

  return (
    <Ctx.Provider value={{ ids, count: ids.length, has, toggle, remove, clear }}>
      {children}
    </Ctx.Provider>
  );
}

export function useWishlist() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useWishlist must be used within WishlistProvider");
  return c;
}
