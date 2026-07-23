import { createFileRoute, Link } from "@tanstack/react-router";
import { Package, FileDown, User, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useMyOrders } from "@/hooks/use-products";
import { downloadInvoice } from "@/lib/invoice";
import type { Order } from "@/lib/types";
import { toast } from "sonner";

export const Route = createFileRoute("/_store/orders")({ component: MyOrders });

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  processing: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
  shipped: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  cancelled: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] ?? "bg-muted text-muted-foreground";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${cls}`}
    >
      {status}
    </span>
  );
}

function MyOrders() {
  const { user, loading: authLoading } = useAuth();
  const { data: orders = [], isLoading } = useMyOrders(!!user);

  const printInvoice = async (order: Order) => {
    try {
      await downloadInvoice(order);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate invoice");
    }
  };

  if (authLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 md:px-6 py-8 md:py-12 space-y-4">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
        <div className="size-20 rounded-full bg-muted grid place-items-center mx-auto mb-6">
          <User className="size-8 text-muted-foreground" />
        </div>
        <h1 className="font-display font-semibold tracking-tight text-3xl">
          Sign in to see orders
        </h1>
        <p className="text-muted-foreground mt-2">
          Your order history and statuses live in your account.
        </p>
        <Link
          to="/auth"
          className="inline-flex mt-6 items-center gap-2 rounded-full bg-brand text-brand-foreground px-6 py-3 text-sm font-semibold hover:bg-secondary-accent transition-colors"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 md:px-6 py-8 md:py-12">
      <h1 className="font-display font-semibold tracking-tight text-3xl md:text-4xl mb-8">
        My Orders
      </h1>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-20 rounded-3xl bg-muted">
          <div className="size-16 rounded-full bg-background grid place-items-center mx-auto mb-5">
            <Package className="size-7 text-muted-foreground" />
          </div>
          <p className="font-display font-semibold text-xl">No orders yet</p>
          <p className="text-muted-foreground text-sm mt-1">
            When you place an order, it will show up here.
          </p>
          <Link
            to="/shop"
            className="inline-flex mt-6 items-center gap-2 rounded-full bg-brand text-brand-foreground px-6 py-3 text-sm font-semibold hover:bg-secondary-accent transition-colors"
          >
            Start shopping
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((o) => (
            <div key={o.id} className="bg-card border rounded-2xl p-5 md:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-sm font-medium">#{o.id.slice(0, 8).toUpperCase()}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(o.created_at).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
                <StatusBadge status={o.status} />
              </div>

              <ul className="mt-4 border-t pt-4 space-y-1.5">
                {o.items.map((it, i) => (
                  <li key={it.id ?? i} className="flex justify-between text-sm">
                    <span className="truncate pr-2">
                      <span className="font-medium">{it.title}</span>
                      <span className="text-muted-foreground"> × {it.qty}</span>
                    </span>
                    <span className="font-semibold">${(it.price * it.qty).toFixed(2)}</span>
                  </li>
                ))}
              </ul>

              {o.status === "shipped" && o.tracking_url && (
                <a
                  href={o.tracking_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
                >
                  <Truck className="h-4 w-4" />
                  Track your delivery
                </a>
              )}

              <div className="mt-4 border-t pt-4 flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => printInvoice(o)}
                >
                  <FileDown className="mr-2 h-4 w-4" />
                  Invoice
                </Button>
                <div className="font-display font-semibold">
                  <span className="text-sm text-muted-foreground mr-2">Total</span>$
                  {Number(o.total).toFixed(2)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
