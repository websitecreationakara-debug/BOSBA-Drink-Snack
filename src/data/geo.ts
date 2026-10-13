import { createServerFn } from "@tanstack/react-start";
import { isBuyerAllowed, visitorCountry } from "@/lib/geo.server";

// Lets the storefront warn visitors outside Cambodia before they fill in the form.
export const getBuyerEligibility = createServerFn({ method: "GET" }).handler(async () => ({
  allowed: isBuyerAllowed(),
  country: visitorCountry(),
}));
