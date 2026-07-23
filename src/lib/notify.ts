// Server-only: on a new order, alerts the store admin (Telegram + email) and
// emails the customer a confirmation. Reuses the same Resend setup as auth
// emails. Never throws — a failed notification must not fail the order itself.
import { Resend } from "resend";

type OrderItem = { id: string; title: string; qty: number; price: number };

export type OrderNotification = {
  id: string;
  total: number;
  items: OrderItem[];
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  address?: string | null;
  city?: string | null;
  postal_code?: string | null;
  scheduled_at?: string | null;
  delivery_method?: string | null;
};

// datetime-local strings ("2026-07-01T14:00") shown as "2026-07-01 14:00".
const formatSchedule = (s?: string | null): string | null => (s ? s.replace("T", " ") : null);

const env: Record<string, string | undefined> = (() => {
  if (typeof process !== "undefined" && typeof process.env !== "undefined") {
    return process.env as Record<string, string | undefined>;
  }
  if (
    typeof import.meta !== "undefined" &&
    typeof (import.meta as { env?: Record<string, string | undefined> }).env !== "undefined"
  ) {
    return (import.meta as { env?: Record<string, string | undefined> }).env!;
  }
  if (
    typeof globalThis !== "undefined" &&
    typeof (globalThis as { env?: Record<string, string | undefined> }).env !== "undefined"
  ) {
    return (globalThis as { env?: Record<string, string | undefined> }).env!;
  }
  return {} as Record<string, string | undefined>;
})();

// Labels which site an alert came from — lets one bot/inbox serve many sites.
// Each deployment overrides this via the SITE_NAME env var.
const siteName = () => env.SITE_NAME?.trim() || "BOSBA Premium Foods";

const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  );

// Email branding. The logo is served from the live site (email clients can't
// bundle assets); overridable per deployment via SITE_LOGO_URL / SITE_URL.
const logoUrl = () => env.SITE_LOGO_URL?.trim() || "https://bosbapremiumfoods.com/invoice-logo.png";
const siteUrl = () => env.SITE_URL?.trim() || "https://bosbapremiumfoods.com";

// Shared shell for every outgoing email: white card on a warm cream page with
// a logo banner on top and a footer strip — receipt-like, consistent branding.
// The light band keeps the black wordmark readable in dark-mode inboxes too.
export const emailShell = (content: string): string => `
  <div style="margin:0;padding:0;background:#f6f4ee">
    <div style="max-width:560px;margin:0 auto;padding:24px 16px">
      <div style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #eae4d4">
        <div style="background:#faf7ef;padding:22px 0;text-align:center;border-bottom:1px solid #eae4d4">
          <img src="${logoUrl()}" alt="${escapeHtml(siteName())}" width="220" style="display:inline-block;max-width:220px;height:auto;border:0" />
        </div>
        <div style="font-family:system-ui,sans-serif;padding:28px 28px 24px">${content}</div>
        <div style="background:#faf8f2;border-top:1px solid #eae4d4;padding:14px 28px;font-family:system-ui,sans-serif">
          <p style="margin:0;font-size:12px;color:#8a8272">${escapeHtml(siteName())} · <a href="${siteUrl()}" style="color:#a5843a">${siteUrl().replace(/^https?:\/\//, "")}</a></p>
        </div>
      </div>
    </div>
  </div>`;

const mapsUrl = (o: OrderNotification): string | null =>
  o.location_lat != null && o.location_lng != null
    ? `https://www.google.com/maps?q=${o.location_lat},${o.location_lng}`
    : null;

const itemRowsHtml = (items: OrderItem[]): string =>
  items
    .map(
      (i) =>
        `<tr><td style="padding:4px 10px">${i.qty}×</td><td style="padding:4px 10px">${escapeHtml(i.title)}</td><td style="padding:4px 10px;text-align:right;white-space:nowrap">$${(i.price * i.qty).toFixed(2)}</td></tr>`,
    )
    .join("");

export async function notifyNewOrder(order: OrderNotification): Promise<void> {
  const short = order.id.slice(0, 8);
  const isPickup = order.delivery_method === "pickup";
  const shipTo = isPickup
    ? "Pickup at store"
    : [order.address, order.city, order.postal_code].filter(Boolean).join(", ");
  const mapLink = isPickup ? null : mapsUrl(order);
  const schedule = formatSchedule(order.scheduled_at);
  const textSummary = [
    `Order #${short}`,
    `Customer: ${order.customer_name ?? "—"} (${order.customer_email ?? "—"})`,
    `Phone: ${order.customer_phone ?? "—"}`,
    `${isPickup ? "🏪" : "Deliver to:"} ${shipTo || "—"}`,
    ...(schedule ? [`🗓️ Scheduled: ${schedule}`] : []),
    ...(mapLink ? [`📍 Map: ${mapLink}`] : []),
    "Items:",
    ...order.items.map((i) => `  ${i.qty}× ${i.title} — $${(i.price * i.qty).toFixed(2)}`),
    `Total: $${order.total.toFixed(2)}`,
  ].join("\n");

  // Fan out to every configured channel; one failing must not block the others or the order.
  const results = await Promise.allSettled([
    sendTelegram(textSummary),
    sendEmail(order, short, shipTo),
    sendCustomerEmail(order, short, shipTo),
  ]);
  if (results.every((r) => r.status === "fulfilled" && r.value === "skipped")) {
    // Nothing configured (e.g. local dev) — log so the order is still visible.
    console.log(`[order-notify]\n${textSummary}`);
  }
}

async function sendTelegram(text: string): Promise<"sent" | "skipped"> {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return "skipped";
  try {
    const payload: Record<string, unknown> = {
      chat_id: chatId,
      text: `🌐 Website: ${siteName()}\n🛎️ New order\n\n${text}`,
      disable_web_page_preview: true,
    };
    // Forum supergroups route messages into a specific topic by thread id.
    if (env.TELEGRAM_TOPIC_ID) payload.message_thread_id = Number(env.TELEGRAM_TOPIC_ID);
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) console.error("[order-notify] telegram failed", res.status, await res.text());
  } catch (e) {
    console.error("[order-notify] telegram error", e);
  }
  return "sent";
}

async function sendEmail(
  order: OrderNotification,
  short: string,
  shipTo: string,
): Promise<"sent" | "skipped"> {
  const to = (env.ADMIN_NOTIFY_EMAIL ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!env.RESEND_API_KEY || to.length === 0) return "skipped";
  try {
    const resend = new Resend(env.RESEND_API_KEY);
    const from = env.RESEND_FROM ?? "BOSBA Premium Foods <onboarding@resend.dev>";
    const rows = itemRowsHtml(order.items);
    const html = emailShell(`
        <p style="margin:0 0 8px;font-size:13px;color:#888">🌐 ${escapeHtml(siteName())}</p>
        <h2 style="margin:0 0 4px">🛎️ New order #${short}</h2>
        <p style="margin:0 0 16px;color:#555">A new order was just placed.</p>
        <p style="margin:0 0 2px"><strong>Customer:</strong> ${escapeHtml(order.customer_name ?? "—")}</p>
        <p style="margin:0 0 2px"><strong>Email:</strong> ${escapeHtml(order.customer_email ?? "—")}</p>
        <p style="margin:0 0 2px"><strong>Phone:</strong> ${escapeHtml(order.customer_phone ?? "—")}</p>
        <p style="margin:0 0 2px"><strong>${order.delivery_method === "pickup" ? "🏪" : "Deliver to:"}</strong> ${escapeHtml(shipTo || "—")}</p>
        ${formatSchedule(order.scheduled_at) ? `<p style="margin:0 0 2px"><strong>🗓️ Scheduled:</strong> ${escapeHtml(formatSchedule(order.scheduled_at)!)}</p>` : ""}
        ${order.delivery_method !== "pickup" && mapsUrl(order) ? `<p style="margin:0 0 16px"><strong>📍 Location:</strong> <a href="${mapsUrl(order)}">Open in Google Maps</a></p>` : ""}
        <table style="border-collapse:collapse;width:100%;border-top:1px solid #eee">${rows}</table>
        <p style="margin:16px 0 0;font-size:18px"><strong>Total: $${order.total.toFixed(2)}</strong></p>`);
    await resend.emails.send({
      from,
      to,
      subject: `[${siteName()}] 🛎️ New order #${short} — $${order.total.toFixed(2)}`,
      html,
    });
  } catch (e) {
    console.error("[order-notify] email failed", e);
  }
  return "sent";
}

export type ShippedNotification = {
  id: string;
  items: OrderItem[];
  total: number;
  customer_name?: string | null;
  customer_email?: string | null;
  tracking_url?: string | null;
};

// Emails the customer when their order is marked shipped. Like the others, it
// never throws and silently skips when Resend or the customer email is missing.
export async function notifyOrderShipped(order: ShippedNotification): Promise<void> {
  const to = order.customer_email?.trim();
  if (!env.RESEND_API_KEY || !to) return;
  const short = order.id.slice(0, 8);
  try {
    const resend = new Resend(env.RESEND_API_KEY);
    const from = env.RESEND_FROM ?? "BOSBA Premium Foods <onboarding@resend.dev>";
    const name = order.customer_name?.trim() || "there";
    const track = order.tracking_url?.trim();
    const html = emailShell(`
        <h2 style="margin:0 0 4px">Your order is on the way! 🛵</h2>
        <p style="margin:0 0 16px;color:#555">Hi ${escapeHtml(name)}, your order #${short} has been shipped and is out for delivery.</p>
        ${
          track
            ? `<p style="margin:0 0 20px"><a href="${escapeHtml(track)}" style="display:inline-block;background:#00b14f;color:#fff;text-decoration:none;padding:12px 22px;border-radius:9999px;font-weight:600">Track your delivery</a></p>`
            : ""
        }
        <table style="border-collapse:collapse;width:100%;border-top:1px solid #eee">${itemRowsHtml(order.items)}</table>
        <p style="margin:16px 0 0;font-size:18px"><strong>Total: $${order.total.toFixed(2)}</strong></p>`);
    await resend.emails.send({
      from,
      to,
      subject: `Your ${siteName()} order #${short} is on the way 🛵`,
      html,
    });
  } catch (e) {
    console.error("[order-notify] shipped email failed", e);
  }
}

async function sendCustomerEmail(
  order: OrderNotification,
  short: string,
  shipTo: string,
): Promise<"sent" | "skipped"> {
  const to = order.customer_email?.trim();
  if (!env.RESEND_API_KEY || !to) return "skipped";
  try {
    const resend = new Resend(env.RESEND_API_KEY);
    const from = env.RESEND_FROM ?? "BOSBA Premium Foods <onboarding@resend.dev>";
    const name = order.customer_name?.trim() || "there";
    const html = emailShell(`
        <h2 style="margin:0 0 4px">Thank you for your order, ${escapeHtml(name)}! 🙏</h2>
        <p style="margin:0 0 16px;color:#555">We've received your order and will start preparing it for you shortly. Thank you for shopping with us!</p>
        <p style="margin:0 0 2px"><strong>Order #:</strong> ${short}</p>
        ${
          order.delivery_method === "pickup"
            ? `<p style="margin:0 0 2px"><strong>🏪 Pickup at store</strong></p>`
            : shipTo
              ? `<p style="margin:0 0 2px"><strong>Deliver to:</strong> ${escapeHtml(shipTo)}</p>`
              : ""
        }
        ${formatSchedule(order.scheduled_at) ? `<p style="margin:0 0 16px"><strong>🗓️ Scheduled for:</strong> ${escapeHtml(formatSchedule(order.scheduled_at)!)}</p>` : ""}
        <table style="border-collapse:collapse;width:100%;border-top:1px solid #eee">${itemRowsHtml(order.items)}</table>
        <p style="margin:16px 0 0;font-size:18px"><strong>Total: $${order.total.toFixed(2)}</strong></p>`);
    await resend.emails.send({
      from,
      to,
      subject: `Your ${siteName()} order #${short} is confirmed`,
      html,
    });
  } catch (e) {
    console.error("[order-notify] customer email failed", e);
  }
  return "sent";
}
