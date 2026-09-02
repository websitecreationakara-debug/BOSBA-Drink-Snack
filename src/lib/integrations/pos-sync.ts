import { env } from "cloudflare:workers";

const POS_BASE_URL = "https://pos-system-inky-ten.vercel.app";
const POS_STOCK_SYNC_URL = `${POS_BASE_URL}/api/stock-sync`;
const POS_PRODUCT_SYNC_URL = `${POS_BASE_URL}/api/product-sync`;
const SITE_ID = "bosba-drink-snack";

// Push side of Phase 7's POS<->site stock sync: after an online order decrements
// this site's own stock, tell POS so its count (source of truth for products
// also sold in-store) stays right too. Best-effort -- must never block or fail
// a real checkout just because POS is briefly unreachable.
export async function notifyPosOfSale(productId: string, quantitySold: number): Promise<void> {
  const secret = (env as { STOCK_SYNC_SECRET?: string }).STOCK_SYNC_SECRET;
  if (!secret) return;

  try {
    await fetch(POS_STOCK_SYNC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ site: SITE_ID, siteProductId: productId, quantitySold }),
      signal: AbortSignal.timeout(8000),
    });
  } catch (error) {
    console.error(`POS stock-sync notify failed for product ${productId}`, error);
  }
}

// Same push, for when admin manually edits a product's stock rather than an
// online order consuming it -- sends the new absolute value instead of a
// quantity sold.
export async function notifyPosOfStockEdit(productId: string, stock: number): Promise<void> {
  const secret = (env as { STOCK_SYNC_SECRET?: string }).STOCK_SYNC_SECRET;
  if (!secret) return;

  try {
    await fetch(POS_STOCK_SYNC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ site: SITE_ID, siteProductId: productId, stock }),
      signal: AbortSignal.timeout(8000),
    });
  } catch (error) {
    console.error(`POS stock-sync notify failed for product ${productId}`, error);
  }
}

// Push side of Phase 7's product creation sync: when a brand-new simple
// product is created here, tell POS so it appears there automatically
// instead of needing to be added and linked by hand. Skipped for variable
// (size/variant) products -- POS doesn't model those yet.
export async function notifyPosOfNewProduct(
  productId: string,
  title: string,
  price: number,
  stock: number | null
): Promise<void> {
  const secret = (env as { STOCK_SYNC_SECRET?: string }).STOCK_SYNC_SECRET;
  if (!secret) return;

  try {
    await fetch(POS_PRODUCT_SYNC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ site: SITE_ID, siteProductId: productId, title, price, stock }),
      signal: AbortSignal.timeout(8000),
    });
  } catch (error) {
    console.error(`POS product-sync notify failed for product ${productId}`, error);
  }
}
