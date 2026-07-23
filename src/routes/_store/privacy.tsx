import { createFileRoute } from "@tanstack/react-router";

const SITE = "https://bosbapremiumfoods.com";
const UPDATED = "29 June 2026";

export const Route = createFileRoute("/_store/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — BOSBA Premium Foods" },
      {
        name: "description",
        content: "How BOSBA Premium Foods collects, uses, and protects your personal information.",
      },
    ],
    links: [{ rel: "canonical", href: `${SITE}/privacy` }],
  }),
  component: Privacy,
});

function Privacy() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 md:py-16">
      <h1 className="font-display font-semibold tracking-tight text-3xl md:text-4xl">
        Privacy Policy
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: {UPDATED}</p>

      <div className="mt-8 space-y-8 text-[15px] leading-relaxed text-muted-foreground [&_h2]:font-display [&_h2]:font-semibold [&_h2]:text-lg [&_h2]:text-foreground [&_h2]:mt-8 [&_h2]:mb-2 [&_a]:text-brand [&_a]:underline">
        <p>
          BOSBA Premium Foods (“we”, “us”) operates the website at{" "}
          <a href={SITE}>bosbapremiumfoods.com</a> and its companion mobile app. This policy explains
          what information we collect, how we use it, and the choices you have. By using our store
          you agree to this policy.
        </p>

        <div>
          <h2>Information we collect</h2>
          <p>When you browse, place an order, or create an account, we may collect:</p>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            <li>
              <strong>Contact &amp; delivery details</strong> — your name, email, phone number,
              delivery address and city.
            </li>
            <li>
              <strong>Location</strong> — if you tap “Pin location” at checkout, the GPS coordinates
              you share so we can deliver accurately. This is optional and only captured when you
              allow it.
            </li>
            <li>
              <strong>Order information</strong> — the items you buy, order totals, promo codes, and
              delivery preferences.
            </li>
            <li>
              <strong>Account information</strong> — if you register, your login credentials
              (passwords are stored only as secure hashes). You may also sign in with Google, in
              which case we receive your name and email from Google.
            </li>
            <li>
              <strong>Usage &amp; device data</strong> — collected automatically through cookies and
              analytics tools to understand how the store is used.
            </li>
          </ul>
        </div>

        <div>
          <h2>How we use your information</h2>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            <li>To process, deliver, and confirm your orders.</li>
            <li>To contact you about your order or respond to enquiries.</li>
            <li>To process payments (cash on delivery or KHQR online payment).</li>
            <li>To improve our products, website, and customer experience.</li>
            <li>To send order updates and, where you’ve agreed, occasional offers.</li>
          </ul>
        </div>

        <div>
          <h2>Payments</h2>
          <p>
            For online payments we use a licensed Cambodian bank payment gateway (KHQR). Your
            payment is processed by the bank; we receive only a confirmation that the payment
            succeeded and a transaction reference. We do not store your full banking details on our
            servers.
          </p>
        </div>

        <div>
          <h2>Sharing your information</h2>
          <p>
            We do not sell your personal information. We share it only with the service providers
            needed to run the store — for example our delivery staff, our email provider (Resend),
            our hosting and analytics provider (Cloudflare), and the bank that processes KHQR
            payments — and only as far as needed to provide the service or comply with the law.
          </p>
        </div>

        <div>
          <h2>Cookies &amp; analytics</h2>
          <p>
            We use cookies and similar technologies for essential site functionality (such as your
            cart and login session) and for analytics. We also use the TikTok Pixel to measure the
            performance of our marketing. You can control cookies through your browser settings.
          </p>
        </div>

        <div>
          <h2>Data retention</h2>
          <p>
            We keep order and account records for as long as needed to provide the service, meet
            legal and accounting obligations, and resolve disputes. You can ask us to delete your
            account at any time.
          </p>
        </div>

        <div>
          <h2>Your rights</h2>
          <p>
            You may request access to, correction of, or deletion of the personal information we
            hold about you. To do so, contact us using the details below.
          </p>
        </div>

        <div>
          <h2>Children</h2>
          <p>
            Our store is intended for adults. We do not knowingly collect personal information from
            children under 13.
          </p>
        </div>

        <div>
          <h2>Changes to this policy</h2>
          <p>
            We may update this policy from time to time. The “last updated” date above shows when it
            last changed.
          </p>
        </div>

        <div>
          <h2>Contact us</h2>
          <p>
            BOSBA Premium Foods
            <br />
            Sangkat Tuol Svay Prey Ti Muoy, Phnom Penh, Cambodia
            <br />
            Phone: <a href="tel:+85599361350">+855 99 361 350</a>
            <br />
            Telegram: <a href="https://t.me/bosbapremiumsfoods">@bosbapremiumsfoods</a>
          </p>
        </div>
      </div>
    </div>
  );
}
