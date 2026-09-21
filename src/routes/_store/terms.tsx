import { createFileRoute } from "@tanstack/react-router";

const SITE = "https://bosbadrinksnack.com";
const UPDATED = "19 September 2026";

export const Route = createFileRoute("/_store/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — BOSBA Drink Snack" },
      {
        name: "description",
        content: "The terms that apply when you use the BOSBA Drink Snack store.",
      },
    ],
    links: [{ rel: "canonical", href: `${SITE}/terms` }],
  }),
  component: Terms,
});

function Terms() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 md:py-16">
      <h1 className="font-display font-semibold tracking-tight text-3xl md:text-4xl">
        Terms of Service
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: {UPDATED}</p>

      <div className="mt-8 space-y-8 text-[15px] leading-relaxed text-muted-foreground [&_h2]:font-display [&_h2]:font-semibold [&_h2]:text-lg [&_h2]:text-foreground [&_h2]:mt-8 [&_h2]:mb-2 [&_a]:text-brand [&_a]:underline">
        <p>
          These terms govern your use of the website at <a href={SITE}>bosbadrinksnack.com</a>{" "}
          operated by BOSBA Drink Snack (“we”, “us”). By browsing our store or placing an order, you
          agree to these terms.
        </p>

        <div>
          <h2>Orders</h2>
          <p>
            Placing an order is an offer to buy the selected products at the price shown at
            checkout. We may decline or cancel an order — for example if an item is out of stock,
            the delivery address is out of range, or we suspect fraud — in which case we will let
            you know and refund any payment already taken.
          </p>
        </div>

        <div>
          <h2>Pricing &amp; availability</h2>
          <p>
            Prices are shown in the currency displayed at checkout and may change without notice. We
            try to keep stock and pricing accurate, but errors can happen; if a listed price or
            availability is wrong, we will contact you before fulfilling the order.
          </p>
        </div>

        <div>
          <h2>Payment</h2>
          <p>
            We accept cash on delivery and online payment via KHQR. Online payments are processed by
            a licensed Cambodian bank payment gateway — see our{" "}
            <a href="/privacy">Privacy Policy</a> for how that payment data is handled.
          </p>
        </div>

        <div>
          <h2>Delivery</h2>
          <p>
            Delivery times are estimates, not guarantees, and can be affected by weather, traffic,
            or address accuracy. Please make sure your delivery address and phone number are correct
            at checkout.
          </p>
        </div>

        <div>
          <h2>Returns &amp; refunds</h2>
          <p>
            If an item arrives damaged, incorrect, or missing, contact us within 24 hours of
            delivery with your order details so we can arrange a replacement or refund. Perishable
            food and drink items cannot be returned once accepted unless they are faulty or
            incorrect.
          </p>
        </div>

        <div>
          <h2>Account use</h2>
          <p>
            If you create an account, you are responsible for keeping your login details secure and
            for activity that happens under your account. Let us know right away if you suspect
            unauthorized use.
          </p>
        </div>

        <div>
          <h2>Liability</h2>
          <p>
            We provide the store on an “as is” basis and are not liable for indirect or
            consequential losses arising from its use, to the extent permitted by law. Nothing in
            these terms limits liability that cannot be excluded under Cambodian law.
          </p>
        </div>

        <div>
          <h2>Changes to these terms</h2>
          <p>
            We may update these terms from time to time. The “last updated” date above shows when
            they last changed. Continued use of the store after a change means you accept the
            updated terms.
          </p>
        </div>

        <div>
          <h2>Contact us</h2>
          <p>
            BOSBA Drink Snack
            <br />
            Sangkat Tuol Svay Prey Ti Muoy, Phnom Penh, Cambodia
            <br />
            Phone: <a href="tel:+85599361350">+855 99 361 350</a>
            <br />
            Telegram: <a href="https://t.me/bosbadrinksnack_bot">@bosbadrinksnack_bot</a>
          </p>
        </div>
      </div>
    </div>
  );
}
