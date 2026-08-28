import "./lib/error-capture";

import { env } from "cloudflare:workers";
import { eq, like, asc, inArray } from "drizzle-orm";
import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { getDb } from "./db";
import { products, product_variations, product_images, product_tabs } from "./db/schema";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

// Content-Security-Policy. 'unsafe-inline' is required for scripts because the
// app ships inline scripts (TikTok pixel, install-prompt capture, JSON-LD) plus
// TanStack Start's hydration scripts — a nonce-based policy would be a larger
// change. The host allowlists still constrain which external origins may load
// scripts/connect/frame, and frame-ancestors/base-uri/object-src close the
// clickjacking and base-tag vectors. Origins map to real usage: google/gstatic
// = reCAPTCHA, analytics.tiktok = pixel, connect.facebook.net = Meta Pixel
// (fbevents.js) and www.facebook.com = its event transport (beacon in
// connect-src, the iframe/form fallbacks in frame-src/form-action, plus the
// Event Setup Tool loader signals/iwl.js in script-src),
// cloudflareinsights = CF Web Analytics (edge-injected), planifyx = webchat
// widget, nominatim = checkout address lookup, fonts.* = Google Fonts,
// youtube.com = product video embeds (src/lib/youtube.ts).
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "form-action 'self' https://www.facebook.com",

  "script-src 'self' 'unsafe-inline' https://www.google.com https://www.gstatic.com https://analytics.tiktok.com https://connect.facebook.net https://www.facebook.com https://m.facebook.com https://static.cloudflareinsights.com https://botcommerce.planifyx.com",

  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",

  "font-src 'self' data: https://fonts.gstatic.com",

  "img-src 'self' data: blob: https:",

  "connect-src 'self' https://nominatim.openstreetmap.org https://www.google.com https://analytics.tiktok.com https://www.facebook.com https://m.facebook.com https://connect.facebook.net https://static.cloudflareinsights.com https://cloudflareinsights.com https://signals.birch.click",

  "frame-src 'self' https://www.google.com https://www.facebook.com https://botcommerce.planifyx.com https://www.youtube.com",

  "worker-src 'self' blob:",

  "manifest-src 'self'",

  "upgrade-insecure-requests",
].join("; ");

const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy": CSP,
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  // geolocation stays self-enabled: checkout's "use my location" needs it.
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(self)",
};

// Applied at the Worker boundary so every dynamic response (SSR HTML, API,
// media, sitemap, redirects, error page) carries them. Static assets are served
// by the CDN edge before the Worker and don't need a CSP. Rebuilds the response
// because some upstream responses (e.g. Response.redirect) have immutable headers.
function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    if (!headers.has(key)) headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m as { default?: ServerEntry }).default ?? (m as unknown as ServerEntry),
    );
  }
  return serverEntryPromise;
}

// Inbound side of Phase 7's POS<->site stock sync: NOVA POS is the source of
// truth for stock on products it also sells in-store, and pushes updates here
// after any counter sale or manual adjustment. Handled at the raw Worker
// boundary (before TanStack Start routing) since this fork has no other API
// routes yet -- keeps it simple and independent of the app router's auth.
async function handleStockSync(request: Request): Promise<Response> {
  const secret = (env as { STOCK_SYNC_SECRET?: string }).STOCK_SYNC_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  let body: { productId?: string; stock?: number };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  if (typeof body.productId !== "string" || typeof body.stock !== "number") {
    return new Response(JSON.stringify({ error: "Invalid payload" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  await getDb()
    .update(products)
    .set({ stock: Math.max(0, Math.floor(body.stock)) })
    .where(eq(products.id, body.productId));

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

// Lets POS's Stock page search this site's real catalog when a staff member
// links a POS product to its website counterpart, instead of needing someone
// to look the id up by hand. Same auth/boundary approach as handleStockSync.
async function handleProductSearch(request: Request): Promise<Response> {
  const secret = (env as { STOCK_SYNC_SECRET?: string }).STOCK_SYNC_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  if (!q) {
    return new Response(JSON.stringify({ results: [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  const rows = await getDb()
    .select({ id: products.id, title: products.title, stock: products.stock, type: products.type })
    .from(products)
    .where(like(products.title, `%${q}%`))
    .limit(10);

  return new Response(JSON.stringify({ results: rows }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

// ---- Products API ----------------------------------------------------------
// GET    /api/products            -> published products (raw stored values, no
//                                    live-promotion discount). ?status=all with
//                                    a valid token also returns drafts.
// GET    /api/products/:idOrSlug  -> one product by UUID or title slug
// POST   /api/products            -> create a product          (token required)
// PATCH  /api/products/:id        -> partial update            (token required)
// PUT    /api/products/:id        -> alias of PATCH             (token required)
// DELETE /api/products/:id        -> delete (cascades vars/images/tabs) (token)
//
// Writes need `Authorization: Bearer <PRODUCTS_API_TOKEN>` (wrangler secret).
// GET is CORS-open so another site can fetch it straight from the browser;
// writes should come from a server that can hold the token.
const API_CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

const apiSlug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function apiJson(body: unknown, status = 200, cache = "no-store"): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": cache,
      ...API_CORS,
    },
  });
}

function apiTokenOk(request: Request): boolean {
  const token = env.PRODUCTS_API_TOKEN;
  return !!token && request.headers.get("authorization") === `Bearer ${token}`;
}

type ApiProductRow = typeof products.$inferSelect;

function shapeApiProduct(
  p: ApiProductRow,
  variations: (typeof product_variations.$inferSelect)[],
  images: (typeof product_images.$inferSelect)[],
  tabs: (typeof product_tabs.$inferSelect)[],
) {
  return {
    id: p.id,
    slug: apiSlug(p.title),
    title: p.title,
    description: p.description,
    status: p.status,
    type: p.type,
    price: p.price,
    sale_price: p.sale_price,
    category_id: p.category_id,
    stock: p.stock,
    image_url: p.image_url,
    badge: p.badge,
    rating: p.rating,
    weight: p.weight,
    pcs: p.pcs,
    featured: p.featured,
    pre_order: p.pre_order,
    promotion_id: p.promotion_id,
    video_url: p.video_url,
    sort_order: p.sort_order,
    created_at: p.created_at,
    updated_at: p.updated_at,
    variations: variations
      .filter((v) => v.product_id === p.id)
      .map((v) => ({
        id: v.id,
        weight: v.weight,
        flavor: v.flavor,
        price: v.price,
        sale_price: v.sale_price,
        image_url: v.image_url,
        stock: v.stock,
        pcs: v.pcs,
      })),
    images: images.filter((i) => i.product_id === p.id).map((i) => i.url),
    tabs: tabs.filter((t) => t.product_id === p.id).map((t) => ({ title: t.title, body: t.body })),
  };
}

async function withChildren(rows: ApiProductRow[]) {
  const ids = rows.map((r) => r.id);
  if (ids.length === 0) return rows.map((p) => shapeApiProduct(p, [], [], []));
  const db = getDb();
  const [vs, ims, tbs] = await Promise.all([
    db
      .select()
      .from(product_variations)
      .where(inArray(product_variations.product_id, ids))
      .orderBy(asc(product_variations.sort_order)),
    db
      .select()
      .from(product_images)
      .where(inArray(product_images.product_id, ids))
      .orderBy(asc(product_images.sort_order)),
    db
      .select()
      .from(product_tabs)
      .where(inArray(product_tabs.product_id, ids))
      .orderBy(asc(product_tabs.sort_order)),
  ]);
  return rows.map((p) => shapeApiProduct(p, vs, ims, tbs));
}

type ProductWrite = Partial<{
  title: string;
  description: string | null;
  price: number;
  sale_price: number | null;
  category_id: string | null;
  stock: number | null;
  status: string;
  image_url: string | null;
  badge: string | null;
  rating: number | null;
  weight: string | null;
  pcs: number | null;
  type: string;
  featured: boolean;
  pre_order: boolean;
  promotion_id: string | null;
  video_url: string | null;
}>;

// Coerce/validate an incoming JSON body into a column-shaped patch. Only keys
// actually present in `body` end up in the result, so PATCH stays partial.
function coerceProductWrite(body: unknown): { value: ProductWrite } | { error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Body must be a JSON object" };
  }
  const b = body as Record<string, unknown>;
  const out: ProductWrite = {};
  const strOrNull = (v: unknown) => (v == null || v === "" ? null : String(v));
  const numOrNull = (v: unknown) => {
    if (v == null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN;
  };

  if ("title" in b) {
    const t = String(b.title ?? "").trim();
    if (!t) return { error: "title cannot be empty" };
    out.title = t;
  }
  if ("description" in b) out.description = strOrNull(b.description);
  if ("category_id" in b) out.category_id = strOrNull(b.category_id);
  if ("image_url" in b) out.image_url = strOrNull(b.image_url);
  if ("badge" in b) out.badge = strOrNull(b.badge);
  if ("weight" in b) out.weight = strOrNull(b.weight);
  if ("promotion_id" in b) out.promotion_id = strOrNull(b.promotion_id);
  if ("video_url" in b) out.video_url = strOrNull(b.video_url);

  for (const key of ["price", "sale_price", "stock", "rating", "pcs"] as const) {
    if (key in b) {
      const n = numOrNull(b[key]);
      if (Number.isNaN(n)) return { error: `${key} must be a number` };
      if (key === "price") out.price = n ?? 0;
      else out[key] = n;
    }
  }
  if ("status" in b) {
    const s = String(b.status);
    if (s !== "published" && s !== "draft")
      return { error: 'status must be "published" or "draft"' };
    out.status = s;
  }
  if ("type" in b) {
    const t = String(b.type);
    if (t !== "simple" && t !== "variable") return { error: 'type must be "simple" or "variable"' };
    out.type = t;
  }
  if ("featured" in b) out.featured = b.featured === true || b.featured === "true";
  if ("pre_order" in b) out.pre_order = b.pre_order === true || b.pre_order === "true";
  return { value: out };
}

async function handleProductsApi(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const rest = decodeURIComponent(
    url.pathname.replace(/^\/api\/products\/?/, "").replace(/\/+$/, ""),
  );
  const db = getDb();
  const method = request.method.toUpperCase();

  const findTarget = async (): Promise<ApiProductRow | undefined> => {
    if (!rest) return undefined;
    if (UUID_RE.test(rest)) {
      const [row] = await db.select().from(products).where(eq(products.id, rest));
      return row;
    }
    const all = await db.select().from(products);
    return all.find((p) => apiSlug(p.title) === rest);
  };

  // ---- reads ----
  if (method === "GET") {
    const wantAll =
      (url.searchParams.get("status") === "all" || url.searchParams.get("all") === "true") &&
      apiTokenOk(request);
    if (rest) {
      const target = await findTarget();
      if (!target) return apiJson({ error: "Product not found" }, 404);
      const [shaped] = await withChildren([target]);
      return apiJson({ product: shaped }, 200, "public, max-age=300");
    }
    const rows = wantAll
      ? await db.select().from(products).orderBy(asc(products.sort_order), asc(products.title))
      : await db
          .select()
          .from(products)
          .where(eq(products.status, "published"))
          .orderBy(asc(products.sort_order), asc(products.title));
    const shaped = await withChildren(rows);
    return apiJson({ count: shaped.length, products: shaped }, 200, "public, max-age=300");
  }

  // ---- writes (token required) ----
  if (!apiTokenOk(request)) {
    return apiJson(
      { error: "Unauthorized — send Authorization: Bearer <PRODUCTS_API_TOKEN>" },
      401,
    );
  }

  let body: unknown = undefined;
  if (method === "POST" || method === "PATCH" || method === "PUT") {
    try {
      body = await request.json();
    } catch {
      return apiJson({ error: "Invalid JSON body" }, 400);
    }
  }

  if (method === "POST") {
    if (rest) return apiJson({ error: "POST to /api/products (no id)" }, 400);
    const parsed = coerceProductWrite(body);
    if ("error" in parsed) return apiJson({ error: parsed.error }, 422);
    if (!parsed.value.title) return apiJson({ error: "title is required" }, 422);
    const now = new Date().toISOString();
    const insert = {
      title: parsed.value.title,
      description: parsed.value.description ?? null,
      price: parsed.value.price ?? 0,
      sale_price: parsed.value.sale_price ?? null,
      category_id: parsed.value.category_id ?? null,
      stock: parsed.value.stock ?? null,
      status: parsed.value.status ?? "draft",
      image_url: parsed.value.image_url ?? null,
      badge: parsed.value.badge ?? null,
      rating: parsed.value.rating ?? null,
      weight: parsed.value.weight ?? null,
      pcs: parsed.value.pcs ?? null,
      type: parsed.value.type ?? "simple",
      featured: parsed.value.featured ?? false,
      pre_order: parsed.value.pre_order ?? false,
      promotion_id: parsed.value.promotion_id ?? null,
      video_url: parsed.value.video_url ?? null,
      created_at: now,
      updated_at: now,
    };
    const [row] = await db.insert(products).values(insert).returning();
    const [shaped] = await withChildren([row]);
    return apiJson({ product: shaped }, 201);
  }

  if (method === "PATCH" || method === "PUT") {
    const target = await findTarget();
    if (!target) return apiJson({ error: "Product not found" }, 404);
    const parsed = coerceProductWrite(body);
    if ("error" in parsed) return apiJson({ error: parsed.error }, 422);
    if (Object.keys(parsed.value).length === 0) {
      return apiJson({ error: "No writable fields in body" }, 422);
    }
    await db
      .update(products)
      .set({ ...parsed.value, updated_at: new Date().toISOString() })
      .where(eq(products.id, target.id));
    const [row] = await db.select().from(products).where(eq(products.id, target.id));
    const [shaped] = await withChildren([row]);
    return apiJson({ product: shaped });
  }

  if (method === "DELETE") {
    const target = await findTarget();
    if (!target) return apiJson({ error: "Product not found" }, 404);
    await db.delete(product_variations).where(eq(product_variations.product_id, target.id));
    await db.delete(product_images).where(eq(product_images.product_id, target.id));
    await db.delete(product_tabs).where(eq(product_tabs.product_id, target.id));
    await db.delete(products).where(eq(products.id, target.id));
    return apiJson({ ok: true, deleted: target.id });
  }

  return apiJson({ error: "Method not allowed" }, 405);
}

function brandedErrorResponse(): Response {
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isCatastrophicSsrErrorBody(body: string, responseStatus: number): boolean {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return false;
  }

  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return false;
  }

  const fields = payload as Record<string, unknown>;
  const expectedKeys = new Set(["message", "status", "unhandled"]);
  if (!Object.keys(fields).every((key) => expectedKeys.has(key))) {
    return false;
  }

  return (
    fields.unhandled === true &&
    fields.message === "HTTPError" &&
    (fields.status === undefined || fields.status === responseStatus)
  );
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isCatastrophicSsrErrorBody(body, response.status)) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return brandedErrorResponse();
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    // Canonical host: redirect www → apex so the auth session cookie lives on a
    // single host (BETTER_AUTH_URL is the non-www origin). Without this, signing in
    // on www sets the cookie on the apex and the user appears logged out on www.
    const url = new URL(request.url);
    if (url.hostname === "www.bosbadrinksnack.com") {
      url.hostname = "bosbadrinksnack.com";
      return withSecurityHeaders(Response.redirect(url.toString(), 301));
    }

    if (url.pathname === "/api/stock-sync" && request.method === "POST") {
      try {
        return withSecurityHeaders(await handleStockSync(request));
      } catch (error) {
        console.error(error);
        return withSecurityHeaders(
          new Response(JSON.stringify({ error: "Internal error" }), {
            status: 500,
            headers: { "content-type": "application/json" },
          }),
        );
      }
    }

    if (url.pathname === "/api/product-search" && request.method === "GET") {
      try {
        return withSecurityHeaders(await handleProductSearch(request));
      } catch (error) {
        console.error(error);
        return withSecurityHeaders(
          new Response(JSON.stringify({ error: "Internal error" }), {
            status: 500,
            headers: { "content-type": "application/json" },
          }),
        );
      }
    }

    if (url.pathname === "/api/products" || url.pathname.startsWith("/api/products/")) {
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: API_CORS });
      }
      try {
        return withSecurityHeaders(await handleProductsApi(request));
      } catch (error) {
        console.error(error);
        return withSecurityHeaders(
          new Response(JSON.stringify({ error: "Internal error" }), {
            status: 500,
            headers: { "content-type": "application/json", ...API_CORS },
          }),
        );
      }
    }

    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return withSecurityHeaders(await normalizeCatastrophicSsrResponse(response));
    } catch (error) {
      console.error(error);
      return withSecurityHeaders(brandedErrorResponse());
    }
  },
};
