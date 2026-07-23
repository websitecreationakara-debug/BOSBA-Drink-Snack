import type { D1Database } from "@cloudflare/workers-types";

// Typed bindings/vars available on the Cloudflare Worker env, beyond what
// `wrangler types` generates from wrangler.jsonc bindings (worker-configuration.d.ts).
// This augments the same Cloudflare.Env interface that file declares — NOT
// `declare module "cloudflare:workers"`, which uses `export =` and can't be
// augmented with a plain `interface Env {}` the way a namespace can.
//
// This file has a top-level `import`, which makes it an ES module rather than
// a global ambient script — so the augmentation below has to be wrapped in
// `declare global` to actually merge with worker-configuration.d.ts's
// `declare namespace Cloudflare {}` (a plain script file, no imports). Without
// `declare global`, `declare namespace Cloudflare {}` here would just be a
// module-local namespace that shadows nothing and merges with nothing.
declare global {
  namespace Cloudflare {
    interface Env {
      DB: D1Database;
      BETTER_AUTH_SECRET: string;
      BETTER_AUTH_URL?: string;
      RESEND_API_KEY: string;
      RESEND_FROM?: string;
      ADMIN_NOTIFY_EMAIL?: string;
      TELEGRAM_BOT_TOKEN?: string;
      TELEGRAM_CHAT_ID?: string;
      TELEGRAM_TOPIC_ID?: string;
      // KHQR payment gateway (PPCBank). Absent in mock mode — see src/lib/payment.ts.
      PPCBANK_BASE_URL?: string;
      PPCBANK_MERCHANT_CODE?: string;
      PPCBANK_PASSWORD?: string;
      // Comma-separated SHA-256 signing fingerprints for the Play Store TWA app,
      // served at /.well-known/assetlinks.json. From Play App Signing.
      ANDROID_CERT_SHA256?: string;
      // Google reCAPTCHA v3 server secret. When unset, the captcha plugin is not
      // registered (see src/lib/auth.ts). Pair with VITE_RECAPTCHA_SITE_KEY.
      RECAPTCHA_SECRET_KEY?: string;
      // Cloudflare API token (Account > D1 > Edit) used by src/data/restore.ts
      // to apply an uploaded backup via the D1 HTTP API. Admin-only, irreversible.
      CLOUDFLARE_D1_RESTORE_TOKEN?: string;
    }
  }

  interface ImportMetaEnv {
    // Public reCAPTCHA v3 site key, inlined into the client bundle at build time.
    readonly VITE_RECAPTCHA_SITE_KEY?: string;
  }
}

export {};
