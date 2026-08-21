// Pre-order items skip cart/checkout entirely — availability/quantity/price
// isn't confirmed yet, so the sales team handles it manually over chat rather
// than taking payment upfront. Same Telegram handle as the footer/privacy page.
const SALES_TELEGRAM_HANDLE = "bosbadrinksnack_bot";

export function preOrderChatUrl(productTitle: string, variationLabel?: string | null): string {
  const title = variationLabel ? `${productTitle} (${variationLabel})` : productTitle;
  const text = encodeURIComponent(`I'd like to pre-order: ${title}`);
  return `https://t.me/${SALES_TELEGRAM_HANDLE}?text=${text}`;
}
