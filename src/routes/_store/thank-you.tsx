import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { downloadInvoice } from "@/lib/invoice";
import { toast } from "sonner";

type LastOrder = {
  id: string;
  total: number;
  items: { id: string; title: string; qty: number; price: number }[];
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  address?: string;
  city?: string;
  delivery_method?: string;
  created_at?: string;
};

export const Route = createFileRoute("/_store/thank-you")({ component: ThankYou });

function ThankYou() {
  const [order, setOrder] = useState<LastOrder | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("bosba:last-order");
      if (raw) setOrder(JSON.parse(raw) as LastOrder);
    } catch {
      // ignore — show the generic thank-you below
    }
  }, []);

  return (
    <div className="mx-auto max-w-2xl px-6 py-16 text-center">
      <CheckCircle2 className="mx-auto h-16 w-16 text-primary" />
      <h1 className="mt-6 font-display font-semibold tracking-tight text-3xl">
        Thank you{order?.customer_name ? `, ${order.customer_name}` : ""}!
      </h1>
      <p className="mt-3 text-muted-foreground">
        {order?.delivery_method === "pickup"
          ? "Your order has been placed and will be ready for pickup at our store."
          : "Your order has been placed."}
        {order?.customer_email
          ? " We’ll send a confirmation to your email shortly."
          : " We’ll be in touch shortly to confirm."}
      </p>

      {order && (
        <div className="mt-8 bg-muted rounded-2xl p-6 text-left space-y-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Order reference</span>
            <span className="font-mono">#{order.id.slice(0, 8).toUpperCase()}</span>
          </div>
          <div className="border-t pt-4 space-y-2">
            {order.items.map((it, i) => (
              <div key={it.id ?? i} className="flex justify-between text-sm">
                <span className="truncate pr-2">
                  <span className="font-medium">{it.title}</span>
                  <span className="text-muted-foreground"> × {it.qty}</span>
                </span>
                <span className="font-bold">${(it.price * it.qty).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="border-t pt-4 flex justify-between font-display font-semibold text-lg">
            <span>Total</span>
            <span>${Number(order.total).toFixed(2)}</span>
          </div>
          <Button
            variant="outline"
            className="w-full rounded-full"
            onClick={async () => {
              try {
                await downloadInvoice({
                  ...order,
                  created_at: order.created_at ?? new Date().toISOString(),
                });
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Failed to generate invoice");
              }
            }}
          >
            <FileDown className="mr-2 h-4 w-4" />
            Invoice
          </Button>
        </div>
      )}

      <CreateAccountPrompt
        defaultName={order?.customer_name ?? ""}
        defaultEmail={order?.customer_email ?? ""}
        defaultPhone={order?.customer_phone ?? ""}
      />

      <Button asChild size="lg" variant="outline" className="mt-8 rounded-full">
        <Link to="/shop">Continue shopping</Link>
      </Button>
    </div>
  );
}

function CreateAccountPrompt({
  defaultName,
  defaultEmail,
  defaultPhone,
}: {
  defaultName: string;
  defaultEmail: string;
  defaultPhone: string;
}) {
  const { user, loading, signUp } = useAuth();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // Offer only to signed-out guests who left an email to register with.
  if (loading || user || !defaultEmail) return null;

  if (done) {
    return (
      <div className="mt-8 bg-muted rounded-2xl p-6 text-left">
        <p className="font-display font-semibold">Account created 🎉</p>
        <p className="mt-1 text-sm text-muted-foreground">
          You&rsquo;re signed in — next time your details fill in automatically.
        </p>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    setSubmitting(true);
    const { error } = await signUp(
      defaultEmail,
      password,
      defaultName || defaultEmail,
      defaultPhone,
    );
    setSubmitting(false);
    if (error) {
      toast.error(error);
      return;
    }
    setDone(true);
    toast.success("Account created!");
  };

  return (
    <div className="mt-8 bg-card border rounded-2xl p-6 text-left">
      {!open ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-display font-semibold">Create an account?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Save your details for faster checkout next time.
            </p>
          </div>
          <Button onClick={() => setOpen(true)} className="rounded-full shrink-0">
            Set a password
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <p className="font-display font-semibold">Create your account</p>
          <div>
            <Label>Email</Label>
            <Input type="email" value={defaultEmail} readOnly className="bg-muted/50" />
          </div>
          <div>
            <Label>Password</Label>
            <Input
              type="password"
              autoFocus
              required
              minLength={8}
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={submitting} className="w-full rounded-full">
            {submitting ? "Creating…" : "Create account"}
          </Button>
        </form>
      )}
    </div>
  );
}
