import { createStart, createMiddleware, createCsrfMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";

import { renderErrorPage } from "./lib/error-page";
import { getAuth } from "./lib/auth";
import { getDb } from "./db";
import { products, categories } from "./db/schema";
import { slugify } from "./lib/utils";

const SITE = "https://bosbadrinksnack.com";

// Security response headers on every response. Outermost in the chain so it
// stamps SSR pages, API, media, sitemap — whatever flows back through next().
//   HSTS         — force HTTPS for a year (Cloudflare already serves HTTPS).
//   nosniff      — stop browsers MIME-sniffing responses into executable types.
//   frame SAMEORIGIN — block other sites from iframing us (clickjacking).
//   Referrer-Policy — don't leak full URLs to other origins.
const securityHeadersMiddleware = createMiddleware().server(async ({ next }) => {
  const result = await next();
  try {
    const h = result.response.headers;
    h.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    h.set("X-Content-Type-Options", "nosniff");
    h.set("X-Frame-Options", "SAMEORIGIN");
    h.set("Referrer-Policy", "strict-origin-when-cross-origin");
  } catch {
    // A few responses carry immutable headers — skip them rather than 500.
  }
  return result;
});

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// better-auth owns every /api/auth/* route; short-circuit those to its handler.
const authMiddleware = createMiddleware().server(async ({ next }) => {
  const request = getRequest();
  if (new URL(request.url).pathname.startsWith("/api/auth")) {
    return getAuth().handler(request);
  }
  return next();
});

// Serve uploaded media stored as BLOBs in D1, same-origin under /media/<key>.
const mediaMiddleware = createMiddleware().server(async ({ next }) => {
  const request = getRequest();
  const { pathname } = new URL(request.url);
  if (!pathname.startsWith("/media/")) return next();

  const key = decodeURIComponent(pathname.slice("/media/".length));
  // A past bulk-insert wrote these rows as SQL text literals instead of bound
  // blob params, so many `data` values now have TEXT storage class: any byte
  // that isn't valid UTF-8 already got mangled into U+FFFD before it ever
  // reached SQLite. Selecting `data` directly (via Drizzle or the raw D1
  // binding) re-decodes that stored text as UTF-8 and mangles it a second
  // time. `hex(data)` operates on the raw stored bytes and survives intact,
  // so pull the blob through that instead and decode the hex back to bytes.
  const row = await env.DB.prepare("SELECT hex(data) AS hex, content_type FROM media WHERE key = ?")
    .bind(key)
    .first<{ hex: string | null; content_type: string | null }>();
  if (!row?.hex) {
    // Local dev never has media BLOBs synced down (db-sync.mjs deliberately
    // skips them) — fall back to the real site so synced products still
    // show their real images instead of broken thumbnails.
    if (import.meta.env.DEV) return Response.redirect(`${SITE}${pathname}`, 302);
    return new Response("Not found", { status: 404 });
  }

  const bytes = new Uint8Array(row.hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(row.hex.slice(i * 2, i * 2 + 2), 16);

  return new Response(bytes, {
    headers: {
      "content-type": row.content_type ?? "application/octet-stream",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
});

// Digital Asset Links — proves the Play Store TWA app owns this domain so the
// app runs fullscreen with no browser URL bar. The app's signing-key SHA-256
// fingerprint(s) come from Play App Signing; set them as the comma-separated
// ANDROID_CERT_SHA256 Worker var (no code change needed). Until set, this serves
// an empty list, which is harmless.
const ANDROID_PACKAGE = "com.bosbadrinksnack.twa";
const assetlinksMiddleware = createMiddleware().server(async ({ next }) => {
  const request = getRequest();
  if (new URL(request.url).pathname !== "/.well-known/assetlinks.json") return next();

  const fingerprints = (env.ANDROID_CERT_SHA256 ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const body = fingerprints.length
    ? [
        {
          relation: ["delegate_permission/common.handle_all_urls"],
          target: {
            namespace: "android_app",
            package_name: ANDROID_PACKAGE,
            sha256_cert_fingerprints: fingerprints,
          },
        },
      ]
    : [];

  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json",
      "cache-control": "public, max-age=3600",
    },
  });
});

// Dynamic sitemap built from published products + categories so search engines
// always see current URLs. Cached for an hour at the edge.
const sitemapMiddleware = createMiddleware().server(async ({ next }) => {
  const request = getRequest();
  if (new URL(request.url).pathname !== "/sitemap.xml") return next();

  const db = getDb();
  const [prods, cats] = await Promise.all([
    db
      .select({ id: products.id, title: products.title, updated_at: products.updated_at })
      .from(products)
      .where(eq(products.status, "published")),
    db.select({ slug: categories.slug }).from(categories),
  ]);

  const staticUrls = [
    { loc: `${SITE}/`, priority: "1.0" },
    { loc: `${SITE}/shop`, priority: "0.9" },
  ];
  const catUrls = cats.map((c) => ({
    loc: `${SITE}/shop?category=${encodeURIComponent(c.slug)}`,
    priority: "0.7",
  }));
  const prodUrls = prods.map((p) => ({
    loc: `${SITE}/product/${slugify(p.title) || p.id}`,
    lastmod: p.updated_at ? new Date(p.updated_at).toISOString().slice(0, 10) : undefined,
    priority: "0.8",
  }));

  const body = [...staticUrls, ...catUrls, ...prodUrls]
    .map(
      (u) =>
        `  <url><loc>${u.loc}</loc>${
          "lastmod" in u && u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""
        }<priority>${u.priority}</priority></url>`,
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>`;
  return new Response(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
});

// Server functions are same-origin RPC endpoints; reject cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  requestMiddleware: [
    securityHeadersMiddleware,
    errorMiddleware,
    csrfMiddleware,
    authMiddleware,
    mediaMiddleware,
    assetlinksMiddleware,
    sitemapMiddleware,
  ],
}));
