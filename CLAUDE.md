# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

E-commerce store (BOSBA Premium Foods, also served on camitc.com). Single app, not a monorepo. Scaffolded by Lovable, since migrated to Cloudflare D1.

- TypeScript + React 19, ES modules
- TanStack Start (server functions) + TanStack Router (file-based) + TanStack Query
- Vite 7, Tailwind CSS v4 (CSS-first config in `src/styles.css`, no `tailwind.config`), shadcn/ui in `src/components/ui`
- Cloudflare Workers deploy; Cloudflare D1 (SQLite) via Drizzle ORM; better-auth (email+OTP, optional Google OAuth)
- Package manager is **npm** (`bun.lock` is stale scaffold residue — ignore it)

## Commands

- Dev: `npm run dev` — pinned to port 8080 (see gotchas)
- Typecheck: `npx tsc --noEmit -p tsconfig.json` (no script alias)
- Lint: `npm run lint` (`eslint .`) · Format: `npm run format` (`prettier --write .`)
- Build: `npm run build` · Deploy: `npm run deploy` (build + `wrangler deploy -c dist/server/wrangler.json`)
- Migrations: `npm run db:generate` → `npm run db:migrate:local` → `npm run db:migrate:remote`
- `npm run db:push -- --yes` overwrites PROD `categories`+`products` from local — destructive
- Backup remote D1: `npm run backup`

## Conventions

- For non-trivial changes, create a feature branch and open a PR via `gh` — do not commit to main.
- Treat `npm run deploy`, `db:migrate:remote`, and `db:push` as PROD-touching: run only when explicitly asked in that message.
- Server-only modules use the `*.server.ts` suffix — ESLint bans importing `server-only` (Next.js pattern).
- Code style enforced by Prettier (`.prettierrc`): printWidth 100, double quotes, semicolons, trailing commas.

## Gotchas

- **Port 8080 / strictPort is intentional** — the worker's OAuth `redirect_uri` must match the browser port. Don't change it.
- **Dev runs inside workerd** (`@cloudflare/vite-plugin`), so server fns in `src/data/` get the local D1 binding. Don't expect a plain Node dev server.
- **Don't re-add Vite plugins** in `vite.config.ts` (tanstackStart, viteReact, tailwindcss, tsConfigPaths…) — `@lovable.dev/vite-tanstack-config` already includes them; duplicates break the build.
- `routeTree.gen.ts` is generated — don't hand-edit.
- **Never commit** `backups/`, `d1-backup-*.sql`, `d1-restore-*.sql`, `.dev.vars`, `.env*`, `.wrangler/` — the SQL dumps contain password hashes and OAuth tokens. They are gitignored; keep it that way.
- The `supabase/` dir is dead legacy from the original scaffold — the app uses D1 at runtime, not Supabase.

## Layout

- `src/routes/` — file-based routes: `_store/` (storefront), `admin/`, `auth.tsx`
- `src/data/` — TanStack Start server functions (db access; `_auth.ts` has role helpers: `requireAdmin`/`requireManager`/`requireStaff`)
- `src/db/` — Drizzle `schema.ts` + `getDb()`; migrations in `drizzle/migrations/`
- `src/lib/` — auth, i18n, payment, promotions, invoice (jspdf), utils

## Env vars

`BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_TRUSTED_ORIGINS`, `RESEND_API_KEY`/`RESEND_FROM` (without a key, OTP codes log to console in dev), optional `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`. The D1 `DB` binding comes from `wrangler.jsonc`.
