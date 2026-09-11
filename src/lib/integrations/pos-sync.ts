import { env } from "cloudflare:workers";

const POS_BASE_URL = "https://pos-system-inky-ten.vercel.app";
const POS_STOCK_SYNC_URL = `${POS_BASE_URL}/api/stock-sync`;
const POS_PRODUCT_SYNC_URL = `${POS_BASE_URL}/api/product-sync`;
const POS_ORDER_SYNC_URL = `${POS_BASE_URL}/api/order-sync`;
const SITE_ID = "bosba-drink-snack";

export type PosOrderItem = { siteProductId: string; quantity: number; unitPrice: number };

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

// Push side of variation-level sync: when an admin edits a "variable"
// product's own size/flavor (price and/or stock) directly here rather than
// through POS, tell POS so its own linked product for that size stays
// correct too. POS looks the link up by (site, productId, variationId); a
// price/stock left undefined here just isn't included in the payload rather
// than sent as an explicit "no change" value.
export async function notifyPosOfVariationEdit(
  productId: string,
  variationId: string,
  changes: { price?: number; stock?: number | null },
): Promise<void> {
  const secret = (env as { STOCK_SYNC_SECRET?: string }).STOCK_SYNC_SECRET;
  if (!secret) return;
  if (changes.price === undefined && changes.stock === undefined) return;

  try {
    await fetch(POS_STOCK_SYNC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({
        site: SITE_ID,
        siteProductId: productId,
        variationId,
        ...changes,
      }),
      signal: AbortSignal.timeout(8000),
    });
  } catch (error) {
    console.error(
      `POS variation-sync notify failed for product ${productId}/${variationId}`,
      error,
    );
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
  stock: number | null,
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

// Push side of order sync: tell POS a real order was placed here so it gets
// its own paid order + printable invoice in the POS system (see POS's
// /api/order-sync route and create_online_order() DB function), instead of
// only ever nudging a linked product's stock down like notifyPosOfSale above.
// `siteOrderId` is this site's own order id -- POS uses (site, siteOrderId)
// to no-op a retried/duplicate call. Only items POS can actually match to a
// linked product should be passed in (the caller filters those); an order
// with nothing linkable is skipped entirely rather than sent empty.
export async function notifyPosOfOrder(order: {
  siteOrderId: string;
  items: PosOrderItem[];
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  subtotal?: number;
  discount?: number;
  deliveryFee?: number;
  total: number;
  paymentMethod?: "cash" | "bank_qr" | null;
}): Promise<void> {
  const secret = (env as { STOCK_SYNC_SECRET?: string }).STOCK_SYNC_SECRET;
  if (!secret || order.items.length === 0) return;

  try {
    await fetch(POS_ORDER_SYNC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ site: SITE_ID, ...order }),
      signal: AbortSignal.timeout(8000),
    });
  } catch (error) {
    console.error(`POS order-sync notify failed for order ${order.siteOrderId}`, error);
  }
}
