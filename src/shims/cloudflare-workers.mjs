// Client-environment stub for the `cloudflare:workers` virtual module.
//
// @cloudflare/vite-plugin only provides `cloudflare:workers` in the worker (ssr)
// environment. But TanStack Start's `?server-fn-module-lookup` pass parses
// server-function modules (and their import graph: db/index.ts, lib/auth.ts) in
// the CLIENT environment, where that import can't resolve — breaking `vite dev`.
//
// Server-function bodies are stripped from the client bundle, so this `env` is
// never executed in the browser; it exists only to satisfy import analysis.
// The worker build still imports the real `cloudflare:workers` (this stub is
// scoped to the client environment in vite.config.ts).
export const env = {};
