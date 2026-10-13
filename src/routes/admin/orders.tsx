import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listOrders,
  updateOrderStatus,
  updateOrderTracking,
  deleteOrder,
  sendOrderMessage,
  listOrderMessages,
} from "@/data/orders";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useConfirm } from "@/components/common/confirm-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { MapPin, Trash2, FileDown, Mail } from "lucide-react";
import { formatShippingAddress } from "@/lib/utils";
import { downloadInvoice } from "@/lib/pdf/invoice";

export const Route = createFileRoute("/admin/orders")({ component: OrdersAdmin });

function OrdersAdmin() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(null);
  const [compose, setCompose] = useState<{
    id: string;
    email: string;
    name: string | null;
  } | null>(null);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const { data: thread = [] } = useQuery({
    queryKey: ["order-messages", compose?.id],
    queryFn: () => listOrderMessages({ data: { id: compose!.id } }),
    enabled: !!compose,
    refetchInterval: 10000,
  });
  const { data: orders = [] } = useQuery({
    queryKey: ["orders-admin"],
    queryFn: () => listOrders(),
    refetchInterval: 30000,
  });

  const setStatus = async (id: string, status: string) => {
    try {
      await updateOrderStatus({ data: { id, status } });
    } catch (err) {
      return toast.error(err instanceof Error ? err.message : "Failed to update status");
    }
    qc.invalidateQueries({ queryKey: ["orders-admin"] });
    qc.invalidateQueries({ queryKey: ["orders-pending-count"] });
  };

  const saveTracking = async (id: string, tracking_url: string, current: string | null) => {
    if (tracking_url.trim() === (current ?? "")) return;
    try {
      await updateOrderTracking({ data: { id, tracking_url } });
    } catch (err) {
      return toast.error(err instanceof Error ? err.message : "Failed to save tracking link");
    }
    qc.invalidateQueries({ queryKey: ["orders-admin"] });
    toast.success("Tracking link saved");
  };

  const printInvoice = async (order: Parameters<typeof downloadInvoice>[0]) => {
    try {
      await downloadInvoice(order);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate invoice");
    }
  };

  const openCompose = (o: { id: string; customer_email: string; customer_name: string | null }) => {
    setCompose({ id: o.id, email: o.customer_email, name: o.customer_name });
    setSubject(`Regarding your BOSBA Drink Snack order #${o.id.slice(0, 8)}`);
    setMessage("");
  };

  const sendMessage = async () => {
    if (!compose) return;
    setSending(true);
    try {
      await sendOrderMessage({ data: { id: compose.id, subject, message } });
      toast.success(`Email sent to ${compose.email}`);
      setMessage("");
      qc.invalidateQueries({ queryKey: ["order-messages", compose.id] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send email");
    } finally {
      setSending(false);
    }
  };

  const removeOrder = async (id: string) => {
    const ok = await confirm({
      title: "Delete this order?",
      description:
        "The order and its history will be permanently removed. This action cannot be undone.",
      confirmText: "Delete order",
    });
    if (!ok) return;
    try {
      await deleteOrder({ data: { id } });
    } catch (err) {
      return toast.error(err instanceof Error ? err.message : "Failed to delete order");
    }
    qc.invalidateQueries({ queryKey: ["orders-admin"] });
    qc.invalidateQueries({ queryKey: ["orders-pending-count"] });
    toast.success("Order deleted");
  };

  return (
    <div className="max-w-7xl space-y-6">
      <h1 className="font-display font-bold text-3xl">Orders</h1>
      <div className="bg-card border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="text-left px-6 py-3">Order</th>
              <th className="text-left px-6 py-3">Customer</th>
              <th className="text-left px-6 py-3">Date</th>
              <th className="text-left px-6 py-3">Items</th>
              <th className="text-left px-6 py-3">Total</th>
              <th className="text-left px-6 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-t">
                <td className="px-6 py-3 font-mono text-xs">{o.id.slice(0, 8)}</td>
                <td className="px-6 py-3">
                  <div className="font-medium">{o.customer_name ?? "—"}</div>
                  {o.customer_email && (
                    <div className="text-xs text-muted-foreground">{o.customer_email}</div>
                  )}
                  {o.customer_phone && (
                    <div className="text-xs text-muted-foreground">{o.customer_phone}</div>
                  )}
                  {o.delivery_method === "pickup" ? (
                    <div className="text-xs font-medium text-brand">🏪 Pickup at store</div>
                  ) : (
                    (o.address || o.city || o.postal_code) && (
                      <div className="text-xs text-muted-foreground">
                        {formatShippingAddress(o.address, o.city, o.postal_code)}
                      </div>
                    )
                  )}
                  {o.location_lat != null && o.location_lng != null && (
                    <a
                      href={`https://www.google.com/maps?q=${o.location_lat},${o.location_lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
                    >
                      <MapPin className="size-3" /> View on map
                    </a>
                  )}
                  {o.scheduled_at && (
                    <div className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-warning">
                      🗓️ Scheduled: {o.scheduled_at.replace("T", " ")}
                    </div>
                  )}
                </td>
                <td className="px-6 py-3">{new Date(o.created_at).toLocaleDateString()}</td>
                <td className="px-6 py-3">
                  {Array.isArray(o.items) && o.items.length > 0 ? (
                    <ul className="space-y-1">
                      {o.items.map((it, i) => (
                        <li key={it.id ?? i} className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              it.image_url && setPreview({ url: it.image_url, title: it.title })
                            }
                            title={it.image_url ? `View ${it.title} image` : undefined}
                            disabled={!it.image_url}
                            className="shrink-0 disabled:cursor-default"
                          >
                            <span className="block size-8 rounded-md overflow-hidden bg-muted border hover:ring-2 hover:ring-brand transition-shadow">
                              {it.image_url && (
                                <img
                                  src={it.image_url}
                                  alt={it.title}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                              )}
                            </span>
                          </button>
                          <span>
                            <span className="font-medium">{it.title}</span>
                            <span className="text-muted-foreground"> × {it.qty}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-6 py-3 font-bold">
                  ${Number(o.total).toFixed(2)}
                  {o.discount > 0 && (
                    <span className="block text-[11px] font-medium text-brand">
                      {o.promo_code ? `${o.promo_code}: ` : ""}−${Number(o.discount).toFixed(2)}
                    </span>
                  )}
                </td>
                <td className="px-6 py-3">
                  <div className="flex items-center gap-2">
                    <Select value={o.status} onValueChange={(v) => setStatus(o.id, v)}>
                      <SelectTrigger className="w-36 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="processing">Processing</SelectItem>
                        <SelectItem value="shipped">Shipped</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                    {o.customer_email && (
                      <button
                        onClick={() =>
                          openCompose({
                            id: o.id,
                            customer_email: o.customer_email!,
                            customer_name: o.customer_name,
                          })
                        }
                        title="Chat with customer (email from sales@bosbadrinksnack.com)"
                        className="text-muted-foreground hover:text-brand transition-colors"
                      >
                        <Mail className="size-4" />
                      </button>
                    )}
                    <button
                      onClick={() => printInvoice(o)}
                      title="Download invoice (PDF)"
                      className="text-muted-foreground hover:text-brand transition-colors"
                    >
                      <FileDown className="size-4" />
                    </button>
                    <button
                      onClick={() => removeOrder(o.id)}
                      title="Delete order"
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  {o.status === "shipped" && (
                    <Input
                      key={o.tracking_url ?? ""}
                      type="url"
                      defaultValue={o.tracking_url ?? ""}
                      placeholder="Grab delivery link…"
                      title="Paste the Grab tracking link, then click away to save. Sent to the customer when marked Shipped."
                      onBlur={(e) => saveTracking(o.id, e.target.value, o.tracking_url)}
                      className="mt-2 h-8 w-56 text-xs"
                    />
                  )}
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                  No orders yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!compose} onOpenChange={(open) => !open && !sending && setCompose(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Chat with {compose?.name || compose?.email}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="text-xs text-muted-foreground">
              Order #{compose?.id.slice(0, 8)} · emails go from{" "}
              <span className="font-medium">sales@bosbadrinksnack.com</span> to{" "}
              <span className="font-medium">{compose?.email}</span>. Their replies appear here.
            </div>
            <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border bg-muted/40 p-3">
              {thread.length === 0 && (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  No messages yet — write the first one below.
                </p>
              )}
              {thread.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.direction === "out" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                      m.direction === "out" ? "bg-brand text-brand-foreground" : "border bg-card"
                    }`}
                  >
                    <div className="whitespace-pre-wrap break-words">{m.body}</div>
                    <div className="mt-1 text-[10px] opacity-70">
                      {m.direction === "out" ? "Sales" : "Customer"} ·{" "}
                      {new Date(m.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              maxLength={200}
            />
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write your message…"
              rows={4}
              maxLength={5000}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompose(null)} disabled={sending}>
              Close
            </Button>
            <Button onClick={sendMessage} disabled={sending || !subject.trim() || !message.trim()}>
              {sending ? "Sending…" : "Send email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!preview} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{preview?.title}</DialogTitle>
          </DialogHeader>
          {preview && (
            <img
              src={preview.url}
              alt={preview.title}
              className="w-full max-h-[70vh] rounded-lg object-contain bg-muted"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
