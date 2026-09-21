// Server-only: helper shared by the Social feature's platform clients
// (facebook.ts, instagram.ts, telegram.ts, tiktok.ts).
export const SITE = "https://bosbadrinksnack.com";

// Platform APIs fetch media themselves, so a stored /media/<key> path (see
// src/data/media.ts) must be made absolute before being handed to them.
export function absoluteMediaUrl(url: string): string {
  return url.startsWith("/") ? `${SITE}${url}` : url;
}
