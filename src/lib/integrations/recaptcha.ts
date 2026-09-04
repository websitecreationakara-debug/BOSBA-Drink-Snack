// Google reCAPTCHA v3 — generates a per-action token the better-auth captcha
// plugin verifies server-side (see src/lib/auth.ts). The site key is public and
// baked into the client bundle at build time. Without it, every call no-ops and
// returns null so auth still works in environments where reCAPTCHA isn't set up.

const SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, opts: { action: string }) => Promise<string>;
    };
  }
}

let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://www.google.com/recaptcha/api.js?render=${SITE_KEY}`;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load reCAPTCHA"));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

async function getCaptchaToken(action: string): Promise<string | null> {
  if (!SITE_KEY || typeof window === "undefined") return null;
  try {
    await loadScript();
    const grecaptcha = window.grecaptcha;
    if (!grecaptcha) return null;
    return await new Promise<string | null>((resolve) => {
      grecaptcha.ready(() => {
        grecaptcha.execute(SITE_KEY, { action }).then(resolve, () => resolve(null));
      });
    });
  } catch {
    return null;
  }
}

// Returns better-auth client `fetchOptions` carrying the captcha token, or an
// empty object when reCAPTCHA is disabled — spread into the auth call params.
export async function withCaptcha(action: string) {
  const token = await getCaptchaToken(action);
  return token ? { fetchOptions: { headers: { "x-captcha-response": token } } } : {};
}
