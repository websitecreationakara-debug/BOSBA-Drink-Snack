import { getRequest } from "@tanstack/react-start/server";
import { env } from "cloudflare:workers";
import { getDb } from "@/db";
import { adminAuditLog } from "@/db/schema";
import type { SessionUser } from "@/data/_auth";

const SITE_NAME = "BOSBA Drink Snack";

// Logs a security event (sensitive admin action or admin/staff login) locally
// (admin_audit_log) and forwards it to the central cross-site security
// dashboard + Telegram alert. Best-effort: never throws, so a logging hiccup
// can't block the actual admin action or sign-in.
async function recordSecurityEvent(
  type: "action" | "login",
  user: SessionUser,
  action: string,
  detail?: Record<string, unknown>,
): Promise<void> {
  const request = getRequest();
  const ip = request.headers.get("cf-connecting-ip") ?? "";
  // `cf` is only present on real Cloudflare-routed requests; untyped here
  // since TanStack's Request type doesn't declare it. `city` gives a real
  // place name (a "pin") instead of just a raw country code. `latitude`/
  // `longitude` are only ever used to build a map link centrally, never shown
  // as raw numbers. `asOrganization` is the ISP/network name — the practical
  // VPN/hosting-provider tell (real people don't browse from AWS/DigitalOcean).
  const cf = (
    request as unknown as {
      cf?: { country?: string; city?: string; latitude?: string; longitude?: string; asOrganization?: string };
    }
  ).cf;
  const country = cf?.country ?? "";
  const city = cf?.city ?? "";
  const now = Date.now();

  try {
    await getDb().insert(adminAuditLog).values({
      id: crypto.randomUUID(),
      userId: user.id,
      userEmail: user.email,
      role: user.role ?? "",
      type,
      action,
      detail: JSON.stringify(detail ?? {}),
      ipAddress: ip,
      city,
      country,
      createdAt: now,
    });
  } catch {
    // best-effort local log
  }

  const url = env.SECURITY_EVENTS_URL;
  const token = env.SECURITY_EVENTS_API_TOKEN;
  if (!url || !token) return;

  await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      site: SITE_NAME,
      type,
      action,
      actorEmail: user.email,
      role: user.role ?? "",
      detail: detail ?? {},
      ip,
      city,
      country,
      latitude: cf?.latitude ?? "",
      longitude: cf?.longitude ?? "",
      isp: cf?.asOrganization ?? "",
      occurredAt: new Date(now).toISOString(),
    }),
  }).catch(() => {});
}

export function logAdminAction(
  user: SessionUser,
  action: string,
  detail?: Record<string, unknown>,
): Promise<void> {
  return recordSecurityEvent("action", user, action, detail);
}

// Called from the better-auth `hooks.after` sign-in handler (see auth.ts) —
// only for staff/admin roles, never for ordinary customer accounts.
export function logAdminLogin(user: SessionUser): Promise<void> {
  return recordSecurityEvent("login", user, "sign_in");
}
