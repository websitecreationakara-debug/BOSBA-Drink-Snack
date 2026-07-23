import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { startPayment, checkPayment, mockPay } from "@/data/payments";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck, CheckCircle2, Smartphone, XCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_store/pay/$id")({
  validateSearch: (s: Record<string, unknown>) => ({
    ret: s.return === "1",
    failed: s.failed === "1",
  }),
  component: PayScreen,
});

type Charge = {
  status: "unpaid" | "paid";
  amount: number;
  mock: boolean;
  paymentURL?: string;
  qrString?: string;
  ref?: string;
};

function PayScreen() {
  const { id } = Route.useParams();
  const { ret, failed } = Route.useSearch();
  const navigate = useNavigate();
  const [charge, setCharge] = useState<Charge | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const goneToThankYou = useRef(false);

  // True while we're waiting on the gateway: either the customer just came back
  // from PPCBank's page (?return=1) or we're in mock mode showing our own QR.
  const waiting = ret || (!!charge && charge.mock && charge.status === "unpaid");

  const finish = () => {
    if (goneToThankYou.current) return;
    goneToThankYou.current = true;
    setPaid(true);
    setTimeout(() => navigate({ to: "/thank-you" }), 1200);
  };

  // First visit only: create the charge. Real mode redirects to PPCBank's hosted
  // page; mock mode renders our own QR. Skipped when returning from the gateway.
  useEffect(() => {
    if (ret || failed) return;
    let cancelled = false;
    startPayment({ data: { orderId: id } })
      .then((r) => {
        if (cancelled) return;
        if (r.status === "paid") return finish();
        if (!r.mock && r.paymentURL) {
          window.location.assign(r.paymentURL);
          return;
        }
        setCharge(r as Charge);
      })
      .catch(
        (e) => !cancelled && setError(e instanceof Error ? e.message : "Couldn't start payment"),
      );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, ret, failed]);

  // Poll for confirmation while waiting. In real mode checkPayment asks PPCBank
  // (PMS1024); in mock mode the "I've paid" button drives it instead.
  useEffect(() => {
    if (!waiting || paid) return;
    let stop = false;
    const tick = async () => {
      try {
        const r = await checkPayment({ data: { orderId: id } });
        if (r.status === "paid" && !stop) finish();
      } catch {
        // transient — keep polling
      }
    };
    tick();
    const t = setInterval(tick, 3000);
    return () => {
      stop = true;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waiting, paid, id]);

  const simulate = async () => {
    setConfirming(true);
    try {
      await mockPay({ data: { orderId: id } });
      finish();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Payment failed");
      setConfirming(false);
    }
  };

  if (error) {
    return (
      <div className="mx-auto max-w-md px-6 py-20 text-center">
        <h1 className="font-display font-semibold text-2xl">Payment unavailable</h1>
        <p className="mt-2 text-muted-foreground">{error}</p>
        <Button asChild variant="outline" className="mt-6 rounded-full">
          <Link to="/shop">Back to shop</Link>
        </Button>
      </div>
    );
  }

  if (paid) {
    return (
      <div className="mx-auto max-w-md px-6 py-20 text-center">
        <CheckCircle2 className="mx-auto h-16 w-16 text-brand" />
        <h1 className="mt-6 font-display font-semibold text-2xl">Payment received!</h1>
        <p className="mt-2 text-muted-foreground">Taking you to your order…</p>
      </div>
    );
  }

  // Returned from the gateway reporting failure/cancellation — let them retry.
  if (failed) {
    return (
      <div className="mx-auto max-w-md px-6 py-20 text-center">
        <XCircle className="mx-auto h-16 w-16 text-destructive" />
        <h1 className="mt-6 font-display font-semibold text-2xl">Payment not completed</h1>
        <p className="mt-2 text-muted-foreground">
          Your order is still reserved. You can try the payment again.
        </p>
        <Button asChild className="mt-6 w-full rounded-full">
          <Link to="/pay/$id" params={{ id }} search={{ ret: false, failed: false }} reloadDocument>
            Try again
          </Link>
        </Button>
      </div>
    );
  }

  // Returned from the gateway (success path) — confirm server-side, then advance.
  if (ret) {
    return (
      <div className="mx-auto max-w-md px-6 py-32 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
        <p className="mt-4 text-sm text-muted-foreground">Confirming your payment…</p>
      </div>
    );
  }

  if (!charge) {
    return (
      <div className="mx-auto max-w-md px-6 py-32 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
        <p className="mt-4 text-sm text-muted-foreground">Preparing your payment…</p>
      </div>
    );
  }

  // Mock mode only — real mode has already redirected to PPCBank's hosted page.
  return (
    <div className="mx-auto max-w-md px-6 py-12 text-center">
      <h1 className="font-display font-semibold tracking-tight text-2xl">Scan to pay</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Open any banking app, scan the KHQR below, and confirm the payment.
      </p>

      <div className="mt-8 rounded-3xl bg-card border p-6 shadow-sm">
        <div className="flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest text-brand">
          <span>KHQR</span>
        </div>
        <div className="mt-4 flex justify-center">
          <div className="rounded-2xl bg-white p-4">
            <QRCodeSVG value={charge.qrString ?? ""} size={208} marginSize={1} />
          </div>
        </div>
        <div className="mt-5 font-display font-bold text-3xl">${charge.amount.toFixed(2)}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          Order #{id.slice(0, 8).toUpperCase()}
        </div>
      </div>

      <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Waiting for payment…
      </div>

      {charge.mock && (
        <div className="mt-8 rounded-2xl border border-dashed border-warning/60 bg-warning/10 p-5 text-left">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Smartphone className="size-4" /> Test mode
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            The real PPCBank gateway isn&rsquo;t connected yet, so this QR isn&rsquo;t chargeable.
            Use the button below to simulate a successful payment.
          </p>
          <Button onClick={simulate} disabled={confirming} className="mt-3 w-full rounded-full">
            {confirming ? "Confirming…" : "Simulate successful payment"}
          </Button>
        </div>
      )}

      <p className="mt-8 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="size-3.5" /> Your order is reserved until payment completes.
      </p>
    </div>
  );
}
