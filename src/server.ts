import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

// Content-Security-Policy. 'unsafe-inline' is required for scripts because the
// app ships inline scripts (TikTok pixel, install-prompt capture, JSON-LD) plus
// TanStack Start's hydration scripts — a nonce-based policy would be a larger
// change. The host allowlists still constrain which external origins may load
// scripts/connect/frame, and frame-ancestors/base-uri/object-src close the
// clickjacking and base-tag vectors. Origins map to real usage: google/gstatic
// = reCAPTCHA, analytics.tiktok = pixel, cloudflareinsights = CF Web Analytics
// (edge-injected), planifyx = webchat widget, nominatim = checkout address
// lookup, fonts.* = Google Fonts, youtube.com = product video embeds
// (src/lib/youtube.ts).
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' https://www.google.com https://www.gstatic.com https://analytics.tiktok.com https://static.cloudflareinsights.com https://botcommerce.planifyx.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://nominatim.openstreetmap.org https://www.google.com https://analytics.tiktok.com https://static.cloudflareinsights.com https://cloudflareinsights.com",
  "frame-src 'self' https://www.google.com https://botcommerce.planifyx.com https://www.youtube.com",
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

const TELEGRAM_WEBHOOK_PATH = "/api/telegram-webhook";

// Relays messages customers send to @bosbadrinksnack_bot (e.g. the "Chat to
// Pre-Order" product-page button) into the same admin Telegram chat/topic
// that order alerts already go to (src/lib/notify.ts). The bot's token can
// only *send* — Telegram has to be told to POST incoming messages here via
// `setWebhook` (one-time, see scripts/register-telegram-webhook — not run
// automatically). Registered with a secret_token so this endpoint rejects
// anything that isn't really from Telegram.
async function handleTelegramWebhook(request: Request, env: Cloudflare.Env): Promise<Response> {
  const expectedSecret = env.TELEGRAM_WEBHOOK_SECRET;
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!expectedSecret || !token || !chatId) return new Response("Not configured", { status: 404 });

  const providedSecret = request.headers.get("x-telegram-bot-api-secret-token");
  if (providedSecret !== expectedSecret) return new Response("Unauthorized", { status: 401 });

  let update: unknown;
  try {
    update = await request.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const message = (
    update as {
      message?: { text?: string; from?: { first_name?: string; username?: string } };
    }
  ).message;
  const text = message?.text?.trim();
  // Ignore updates with nothing to relay (stickers, plain /start, edited-message pings)
  // and drop anything containing a link — real pre-order questions don't need one, and
  // this is the exact shape of the "track your delivery" phishing spam public bots draw.
  if (text && !/https?:\/\//i.test(text)) {
    const from = message?.from;
    const who = from?.username ? `@${from.username}` : (from?.first_name ?? "A customer");
    const payload: Record<string, unknown> = {
      chat_id: chatId,
      text: `💬 Pre-order chat — ${who}:\n\n${text}`,
      disable_web_page_preview: true,
    };
    if (env.TELEGRAM_TOPIC_ID) payload.message_thread_id = Number(env.TELEGRAM_TOPIC_ID);
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {});
  }

  // Any 2xx tells Telegram the update was delivered; body content is ignored.
  return new Response("ok", { status: 200 });
}

const TELEGRAM_WEBHOOK_REGISTER_PATH = "/api/telegram-webhook/register";

// One-time setup helper: tells Telegram to start POSTing updates for this bot
// to handleTelegramWebhook above. Run once after TELEGRAM_WEBHOOK_SECRET is
// set (`GET /api/telegram-webhook/register?secret=<TELEGRAM_WEBHOOK_SECRET>`)
// — idempotent, safe to re-run. Exists so this can be triggered without ever
// exposing TELEGRAM_BOT_TOKEN outside the Worker (secrets are write-only via
// `wrangler secret put`).
async function handleRegisterTelegramWebhook(request: Request, env: Cloudflare.Env): Promise<Response> {
  const expectedSecret = env.TELEGRAM_WEBHOOK_SECRET;
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!expectedSecret || !token) return new Response("Not configured", { status: 404 });

  const url = new URL(request.url);
  if (url.searchParams.get("secret") !== expectedSecret) {
    return new Response("Unauthorized", { status: 401 });
  }

  const webhookUrl = `${url.origin}${TELEGRAM_WEBHOOK_PATH}`;
  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url: webhookUrl, secret_token: expectedSecret }),
  });
  return new Response(await res.text(), {
    status: res.status,
    headers: { "content-type": "application/json" },
  });
}

const TELEGRAM_WEBHOOK_STATUS_PATH = "/api/telegram-webhook/status";

// Diagnostic helper: proxies Telegram's own getWebhookInfo (last delivery
// error, pending update count, etc.) without ever exposing TELEGRAM_BOT_TOKEN.
async function handleTelegramWebhookStatus(request: Request, env: Cloudflare.Env): Promise<Response> {
  const expectedSecret = env.TELEGRAM_WEBHOOK_SECRET;
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!expectedSecret || !token) return new Response("Not configured", { status: 404 });

  const url = new URL(request.url);
  if (url.searchParams.get("secret") !== expectedSecret) {
    return new Response("Unauthorized", { status: 401 });
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
  return new Response(await res.text(), {
    status: res.status,
    headers: { "content-type": "application/json" },
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

    if (url.pathname === TELEGRAM_WEBHOOK_PATH && request.method === "POST") {
      return handleTelegramWebhook(request, env as Cloudflare.Env);
    }
    if (url.pathname === TELEGRAM_WEBHOOK_REGISTER_PATH && request.method === "GET") {
      return handleRegisterTelegramWebhook(request, env as Cloudflare.Env);
    }
    if (url.pathname === TELEGRAM_WEBHOOK_STATUS_PATH && request.method === "GET") {
      return handleTelegramWebhookStatus(request, env as Cloudflare.Env);
    }

    if (url.hostname === "www.bosbadrinksnack.com") {
      url.hostname = "bosbadrinksnack.com";
      return withSecurityHeaders(Response.redirect(url.toString(), 301));
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
