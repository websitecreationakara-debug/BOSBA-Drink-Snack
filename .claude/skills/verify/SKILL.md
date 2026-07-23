---
name: verify
description: How to run and drive this app end-to-end for verification (dev server, admin auth, Playwright).
---

# Verifying changes in this app

## Launch

- `npm run dev` — pinned to port 8080 (strictPort). If it fails with "Port 8080 is already in use", a dev server is likely already running; since Vite serves from the working tree with HMR, just drive `http://localhost:8080` directly.
- Local D1 lives in `.wrangler/state`; apply migrations with `npm run db:migrate:local` before driving schema changes. Inspect/seed with `npx wrangler d1 execute bosbapremiumfoods --local --json --command "..."`.

## Drive (browser)

No browser automation in the project — install Playwright in the session scratchpad (`npm i playwright && npx playwright install chromium`), not in the repo.

## Admin auth without OTP

`BETTER_AUTH_SECRET` is unset in local dev, so better-auth uses its built-in default secret (see `DEFAULT_SECRET` in `node_modules/better-auth/dist/utils/constants.mjs`). Reuse an existing admin session:

1. `SELECT s.token FROM session s JOIN user u ON u.id=s.user_id WHERE u.role='admin' AND s.expires_at > strftime('%s','now') LIMIT 1;`
2. Sign it: `sig = HMAC-SHA256(defaultSecret, token)` digested as **standard base64** (not base64url).
3. Cookie: `better-auth.session_token = encodeURIComponent(token + "." + sig)` on domain `localhost`.
4. Sanity-check against `GET /api/auth/get-session` before driving admin pages.

## Flows worth driving

- Storefront product page: `/product/<slugified-title>` (e.g. `/product/bluefin-tuna-otoro`).
- Admin products: `/admin/products`, edit via `button[aria-label="Edit"]` in the product's row; file uploads via the hidden `input[type=file]` with `setInputFiles`.
- Generate test images by screenshotting colored `setContent` pages — no image libs needed.

## Gotchas

- Media uploads store bytes in D1 (`media.data` blob) and serve from `/media/<name>.webp`; client compresses to webp before upload.
- Clean up seeded/test rows afterward (`product_images`, `media` with test filenames) — the local DB is the developer's working data.
