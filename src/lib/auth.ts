import { betterAuth, type BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, captcha, emailOTP, twoFactor } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { Resend } from "resend";
import { getDb, schema } from "@/db";
import { emailShell } from "@/lib/notify";

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

let _auth: ReturnType<typeof betterAuth> | undefined;

export function getAuth() {
  if (_auth) return _auth;

  const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;
  const from = env.RESEND_FROM ?? "BOSBA Premium Foods <onboarding@resend.dev>";

  const sendEmail = async (to: string, subject: string, html: string, logLine: string) => {
    if (!resend) {
      // No key configured (e.g. local dev): log the contents instead of failing the request.
      console.log(`[auth-email] ${subject} -> ${to}\n${logLine}`);
      return;
    }
    try {
      await resend.emails.send({ from, to, subject, html: emailShell(html) });
    } catch (e) {
      console.error("[auth-email] send failed", e);
    }
  };

  const trustedOrigins = (env.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  _auth = betterAuth<BetterAuthOptions>({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins,
    database: drizzleAdapter(getDb(), { provider: "sqlite", schema }),
    user: {
      additionalFields: {
        phone: { type: "string", required: false, input: true },
      },
    },
    // Local dev only: keep sessions alive for a year so one login lasts.
    // Production keeps better-auth defaults (7-day expiry, 1-day refresh).
    ...(import.meta.env.DEV
      ? { session: { expiresIn: 60 * 60 * 24 * 365, updateAge: 60 * 60 * 24 } }
      : {}),
    emailAndPassword: {
      enabled: true,
      // Gate sign-in until the email is verified via the OTP code (emailOTP plugin below).
      requireEmailVerification: true,
      sendResetPassword: async ({ user, url }) => {
        await sendEmail(
          user.email,
          "Reset your BOSBA password",
          `<p>Reset your password:</p><p><a href="${url}">${url}</a></p>`,
          url,
        );
      },
    },
    socialProviders:
      env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? {
            google: {
              clientId: env.GOOGLE_CLIENT_ID,
              clientSecret: env.GOOGLE_CLIENT_SECRET,
            },
          }
        : undefined,
    plugins: [
      admin(),
      // TOTP authenticator-app 2FA. When a user has it enabled, sign-in returns
      // a twoFactorRedirect instead of a session until they enter a valid code.
      // "issuer" is the label shown in Google Authenticator etc.
      twoFactor({ issuer: "BOSBA Premium Foods" }),
      // Google reCAPTCHA v3 on sign-up, sign-in, and password-reset requests.
      // Only active when the secret is configured — otherwise auth runs without
      // a captcha (the client also skips the token when no site key is set).
      // Default endpoints cover /sign-up/email, /sign-in/email, and (via substring
      // match) /email-otp/request-password-reset.
      ...(env.RECAPTCHA_SECRET_KEY
        ? [
            captcha({
              provider: "google-recaptcha",
              secretKey: env.RECAPTCHA_SECRET_KEY,
              minScore: 0.5,
            }),
          ]
        : []),
      emailOTP({
        otpLength: 6,
        expiresIn: 600,
        sendVerificationOnSignUp: true,
        overrideDefaultEmailVerification: true,
        sendVerificationOTP: async ({ email, otp }) => {
          await sendEmail(
            email,
            "Your BOSBA verification code",
            `<p>Your verification code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${otp}</p><p>This code expires in 10 minutes.</p>`,
            `code: ${otp}`,
          );
        },
      }),
      tanstackStartCookies(),
    ],
    // Persist rate-limit counters in D1 instead of per-isolate memory. On
    // Workers each request can hit a fresh isolate with its own empty Map, so
    // the default in-memory limiter never accumulates — an attacker can spray
    // password guesses freely. Database storage makes better-auth's built-in
    // limits real: 3 sign-in/sign-up attempts per 10s, 3 password-reset
    // requests per 60s, 100 req/10s elsewhere (all keyed per client IP).
    rateLimit: {
      enabled: true,
      storage: "database",
    },
    advanced: {
      // On Cloudflare the true client IP is in cf-connecting-ip; the default
      // x-forwarded-for can be a proxy chain. Keying on the real IP ensures the
      // limit is per-attacker, not a single shared global bucket.
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
    },
  });

  return _auth;
}
