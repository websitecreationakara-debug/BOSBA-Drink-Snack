// Meta (Facebook) Pixel event helper. The base pixel snippet is inlined in the
// <head> of __root.tsx's RootShell — same pattern as the TikTok pixel there —
// so this module is only a typed, SSR-safe wrapper around the `fbq` global for
// firing events from components. Every call no-ops on the server and when the
// pixel script failed to load (ad blocker, offline, consent tooling, …).

// Storefront prices are all in USD — the store formats everything with a leading
// "$" and src/lib/payment.ts defaults to "USD".
export const PIXEL_CURRENCY = "USD";

type Fbq = (...args: unknown[]) => void;

function getFbq(): Fbq | null {
  if (typeof window === "undefined") return null;
  const fn = (window as unknown as { fbq?: Fbq }).fbq;
  return typeof fn === "function" ? fn : null;
}

/**
 * Fire a Meta Pixel standard (or custom) event. `eventID` lets a later
 * Conversions API integration dedupe the browser and server copies of an event.
 */
export function trackPixel(
  event: string,
  params?: Record<string, unknown>,
  opts?: { eventID?: string },
) {
  const fbq = getFbq();
  if (!fbq) return;
  if (opts?.eventID) {
    fbq("track", event, params ?? {}, { eventID: opts.eventID });
  } else {
    fbq("track", event, params ?? {});
  }
}
