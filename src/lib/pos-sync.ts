import { env } from "cloudflare:workers";

const POS_STOCK_SYNC_URL = "https://pos-system-inky-ten.vercel.app/api/stock-sync";
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
