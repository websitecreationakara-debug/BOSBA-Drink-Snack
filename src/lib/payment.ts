// Server-only KHQR payment gateway adapter (PPCBank "Merchant Web" flow).
//
// MOCK MODE: until PPCBANK_BASE_URL + merchant credentials are set as Worker
// secrets, the gateway is simulated — `createKhqr` returns a placeholder QR
// payload and no real money moves. The customer confirms payment on the /pay
// screen via the `mockPay` server fn, which stands in for a real settlement.
//
// REAL MODE: PPCBank's "Merchant Web" API returns a *hosted payment page URL*
// (not a raw KHQR string), so the /pay screen redirects the customer there.
// Payment is confirmed by polling PMS1024 server-side — there is no webhook.
import { env } from "cloudflare:workers";

export const paymentMockMode = () => !env.PPCBANK_BASE_URL;

// Every PPCBank request/response is wrapped in this envelope; success is
// header.result === true (resultCode "100000").
const REQ_HEADER = { languageCode: "01", channelTypeCode: "03" } as const;

type Envelope<B> = {
  header: { result: boolean; resultCode: string; resultMessage: string };
  body: B;
};

async function ppcFetch<B>(path: string, body: unknown, token?: string): Promise<Envelope<B>> {
  const res = await fetch(`${env.PPCBANK_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PPCBank ${path} HTTP ${res.status}`);
  return (await res.json()) as Envelope<B>;
}

// The JWT is valid ~24h. Cache it on the (reused) Worker isolate so we don't
// re-auth on every order; a cold isolate just authenticates once.
let tokenCache: { token: string; expiresAt: number } | null = null;

// expirationDate is "yyyyMMddHHmmss" in Cambodia time (UTC+7). If it doesn't
// parse we fall back to a short TTL — the 900024 retry below is the real safety net.
function parseExpiry(s: string): number {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(s);
  if (!m) return Date.now() + 12 * 60 * 60 * 1000;
  const [, y, mo, d, h, mi, se] = m;
  return new Date(`${y}-${mo}-${d}T${h}:${mi}:${se}+07:00`).getTime();
}

async function getToken(force = false): Promise<string> {
  if (!force && tokenCache && tokenCache.expiresAt - Date.now() > 60_000) return tokenCache.token;
  const r = await ppcFetch<{ token: string; expirationDate: string }>("/security_check", {
    merchantCode: env.PPCBANK_MERCHANT_CODE,
    password: env.PPCBANK_PASSWORD,
  });
  if (!r.header.result || !r.body?.token) {
    throw new Error(`PPCBank auth failed: ${r.header.resultMessage || r.header.resultCode}`);
  }
  tokenCache = { token: r.body.token, expiresAt: parseExpiry(r.body.expirationDate) };
  return tokenCache.token;
}

// Call an authenticated endpoint, transparently re-authing once if PPCBank says
// the token expired (resultCode 900024) — covers drift between our cached expiry
// and theirs.
async function authed<B>(path: string, body: Record<string, unknown>): Promise<Envelope<B>> {
  const token = await getToken();
  const r = await ppcFetch<B>(path, { header: REQ_HEADER, body }, token);
  if (!r.header.result && r.header.resultCode === "900024") {
    return ppcFetch<B>(path, { header: REQ_HEADER, body }, await getToken(true));
  }
  return r;
}

export type KhqrCharge = {
  // Real mode: PPCBank hosted payment page to send the customer to.
  paymentURL?: string;
  // Mock mode: placeholder KHQR string rendered as a QR on our own screen.
  qrString?: string;
  // billNumber — stored on the order and used to look the payment up (PMS1024).
  ref: string;
  mock: boolean;
};

type CreateArgs = {
  orderId: string;
  amount: number;
  ref?: string | null;
  successURL: string;
  errorURL: string;
  currency?: "USD" | "KHR";
};

// A stable, unique billNumber per order, reused for the order's lifetime so the
// PMS1024 lookup stays consistent across retries. PPCBank examples use a numeric
// string; we derive digits from the order id plus a time prefix.
function billNumberFor(orderId: string, existing?: string | null): string {
  if (existing) return existing;
  return `${Date.now()}${orderId.replace(/\D/g, "").slice(0, 6)}`.slice(0, 20);
}

export async function createKhqr({
  orderId,
  amount,
  ref,
  successURL,
  errorURL,
  currency = "USD",
}: CreateArgs): Promise<KhqrCharge> {
  const billNumber = billNumberFor(orderId, ref);

  if (paymentMockMode()) {
    return {
      ref: billNumber,
      mock: true,
      qrString: `KHQR-MOCK|${currency}|${amount.toFixed(2)}|ref=${billNumber}`,
    };
  }

  // expiredTime is PPCBank's QR validity window. TODO(PPCBank): confirm the unit
  // (minutes vs seconds) against the integration guide.
  const r = await authed<{ paymentURL: string }>("/api/v1/PMS1011", {
    merchantCode: env.PPCBANK_MERCHANT_CODE,
    terminalLabel: "",
    mobileNumber: "",
    billNumber,
    storeLabel: "",
    amount,
    currencyCode: currency,
    expiredTime: 60,
    successURL,
    errorURL,
  });
  if (!r.header.result || !r.body?.paymentURL) {
    throw new Error(`PPCBank KHQR failed: ${r.header.resultMessage || r.header.resultCode}`);
  }
  return { ref: billNumber, mock: false, paymentURL: r.body.paymentURL };
}

// Poll a charge's status (PMS1024). Returns whether PPCBank has confirmed payment
// plus the bank reference to record. Mock mode never reaches here.
export async function retrievePaymentResult(
  billNumber: string,
): Promise<{ paid: boolean; referenceNo?: string }> {
  const r = await authed<{ resultYN: string; referenceNo?: string }>("/api/v1/PMS1024", {
    merchantCode: env.PPCBANK_MERCHANT_CODE,
    billNumber,
  });
  if (!r.header.result) {
    throw new Error(
      `PPCBank result check failed: ${r.header.resultMessage || r.header.resultCode}`,
    );
  }
  return { paid: r.body?.resultYN === "Y", referenceNo: r.body?.referenceNo || undefined };
}
