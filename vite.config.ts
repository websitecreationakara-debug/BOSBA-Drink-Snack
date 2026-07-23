// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { cloudflare } from "@cloudflare/vite-plugin";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

const kyselyShim = fileURLToPath(new URL("./src/shims/kysely.mjs", import.meta.url));
const kyselyReal = fileURLToPath(new URL("./node_modules/kysely/dist/index.js", import.meta.url));
const cloudflareWorkersShim = fileURLToPath(
  new URL("./src/shims/cloudflare-workers.mjs", import.meta.url),
);

// `cloudflare:workers` is only resolvable in the worker (ssr) environment. TanStack
// Start's server-fn module lookup parses server-fn import graphs in the CLIENT env,
// where it 500s `vite dev`. Stub it there only — the worker keeps the real module.
const clientCloudflareWorkersStub: Plugin = {
  name: "client-cloudflare-workers-stub",
  resolveId(id) {
    if (id === "cloudflare:workers" && this.environment?.name === "client") {
      return cloudflareWorkersShim;
    }
    return null;
  },
};

// Lovable only applies the Cloudflare plugin at build time. We need it in dev too so
// `vite dev` runs inside workerd with the local D1 binding available to server functions.
// Disable Lovable's build-only cloudflare and add the plugin ourselves for serve + build.
export default defineConfig({
  cloudflare: false,
  plugins: [cloudflare({ viteEnvironment: { name: "ssr" } }), clientCloudflareWorkersStub],
  tanstackStart: {
    spa: { enabled: true },
  },
  vite: {
    // Pin to 8080 (the Cloudflare worker's internal host port) so the OAuth redirect_uri
    // the worker generates matches the port the browser is actually on. strictPort keeps it stable.
    server: { port: 8080, strictPort: true },
    // Only the bare "kysely" specifier (not subpaths) maps to the shim that adds the
    // two migration constants @better-auth/kysely-adapter expects (see the shim file).
    resolve: {
      alias: [
        { find: /^kysely$/, replacement: kyselyShim },
        { find: /^kysely-real$/, replacement: kyselyReal },
      ],
    },
    build: {
      chunkSizeWarningLimit: 1000,
    },
    // better-auth bundles @better-auth/kysely-adapter (kysely), whose named exports
    // esbuild can't statically resolve during pre-bundling. We use the drizzle adapter,
    // so exclude these from optimization in both the client and the worker (ssr) env.
    optimizeDeps: {
      exclude: ["better-auth", "@better-auth/kysely-adapter", "kysely"],
    },
    environments: {
      ssr: {
        optimizeDeps: {
          exclude: ["better-auth", "@better-auth/kysely-adapter", "kysely"],
        },
      },
    },
  },
});
