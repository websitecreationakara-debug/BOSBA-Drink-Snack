import { getRequest } from "@tanstack/react-start/server";

// Orders are only accepted from buyers located in Cambodia. Cloudflare stamps
// every request with the visitor's ISO-3166 country (CF-IPCountry), derived from
// the connecting IP, so it can't be spoofed by the client.
const ALLOWED_COUNTRY = "KH";

export const OUTSIDE_CAMBODIA_MESSAGE = "Sorry, we only accept orders from customers in Cambodia.";

// Returns the visitor's country code, or null when it can't be determined. That
// only happens off Cloudflare (local `npm run dev`), so dev stays usable.
export function visitorCountry(): string | null {
  const request = getRequest();
  // request.cf is always populated by the Workers runtime; the header depends on
  // the zone's IP Geolocation setting. Prefer cf, fall back to the header.
  const cfCountry = (request as { cf?: { country?: string } }).cf?.country;
  const raw = (cfCountry ?? request.headers.get("cf-ipcountry"))?.trim().toUpperCase();
  return raw || null;
}

// "XX" = Cloudflare couldn't resolve the IP, "T1" = Tor. Neither is Cambodia.
export function isBuyerAllowed(): boolean {
  const country = visitorCountry();
  return country === null || country === ALLOWED_COUNTRY;
}

// Server-side guard — call from any function that places an order.
export function assertBuyerInCambodia() {
  if (!isBuyerAllowed()) throw new Error(OUTSIDE_CAMBODIA_MESSAGE);
}
