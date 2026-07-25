import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(s: string) {
  return UUID_RE.test(s);
}

// Builds a shipping address line from address/city/postal_code without
// repeating city or postal code when they're already embedded in the address
// string — e.g. reverse-geocoded addresses from checkout's map pin already
// include the city, since that's just a substring of Nominatim's display_name.
export function formatShippingAddress(
  address?: string | null,
  city?: string | null,
  postalCode?: string | null,
) {
  const parts = [address, city, postalCode].filter((p): p is string => {
    if (!p) return false;
    if (!address || p === address) return true;
    return !address.toLowerCase().includes(p.toLowerCase());
  });
  return parts.join(", ");
}
