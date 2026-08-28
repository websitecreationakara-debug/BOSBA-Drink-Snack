import "./lib/error-capture";

import { env } from "cloudflare:workers";
import { eq, like } from "drizzle-orm";
import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { getDb } from "./db";
import { products } from "./db/schema";

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

  "script-src 'self' 'unsafe-inline' https://www.google.com https://www.gstatic.com https://analytics.tiktok.com https://connect.facebook.net https://www.facebook.com https://static.cloudflareinsights.com https://botcommerce.planifyx.com",

  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",

  "connect-src 'self' https://nominatim.openstreetmap.org https://www.google.com https://analytics.tiktok.com https://www.facebook.com https://connect.facebook.net https://static.cloudflareinsights.com https://cloudflareinsights.com https://signals.birch.click",

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
