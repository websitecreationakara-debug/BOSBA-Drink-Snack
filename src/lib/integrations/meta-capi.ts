// Server-side helper for Meta's click-id cookie, shared by any code that needs to hand a
// storefront session's _fbc value to an outside Conversions API sender -- currently just POS's
// own send (see orders.ts's notifyPosOfOrder call, forwarded on to metaConversions.ts there).
// This site has no server-side CAPI dispatch of its own yet (unlike BOSBA Premium Foods'
// data/meta-capi.ts) -- <MetaPixelProvider> in __root.tsx only fires the browser-side Pixel.

// _fbc is Meta's own first-party cookie (set by the Pixel script / ad-click redirect) --
// forwarded as-is, never hashed, to improve match quality. Not present until the Pixel has run
// at least once, hence the fbclid fallback below.
function readCookie(cookieHeader: string, name: string): string | undefined {
  const match = cookieHeader
    .split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith(`${name}=`));
  return match?.slice(name.length + 1);
}

// Meta's documented fallback when the cookie hasn't been written yet (e.g. checkout completing
// right after landing from an ad click, before the Pixel's async script has run): derive the same
// shape from the fbclid query param instead. Format per Meta's spec:
// fb.<subdomain_index>.<creation_time_ms>.<fbclid> (subdomain_index 1 = cookie set on the eTLD+1,
// true for this site).
export function deriveFbc(cookieHeader: string, eventSourceUrl: string): string | undefined {
  const fromCookie = readCookie(cookieHeader, "_fbc");
  if (fromCookie) return fromCookie;

  try {
    const fbclid = new URL(eventSourceUrl).searchParams.get("fbclid");
    return fbclid ? `fb.1.${Date.now()}.${fbclid}` : undefined;
  } catch {
    return undefined;
  }
}
