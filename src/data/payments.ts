import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { orders } from "@/db/schema";
import { createKhqr, paymentMockMode, retrievePaymentResult } from "@/lib/payment";
import { markOrderPaid } from "./orders";

// Generate (or re-use) the KHQR for an awaiting-payment order and return what the
// /pay screen needs. Guest-accessible: orders are addressed by their unguessable
// UUID, and this only ever exposes that order's own payment details.
export const startPayment = createServerFn({ method: "POST" })
  .inputValidator((d: { orderId: string }) => d)
  .handler(async ({ data }) => {
    const db = getDb();
    const [order] = await db.select().from(orders).where(eq(orders.id, data.orderId));
    if (!order) throw new Error("Order not found");
    if (order.payment_method !== "khqr") throw new Error("This order is not paid online");

    if (order.payment_status === "paid") {
      return { status: "paid" as const, amount: order.total, mock: paymentMockMode() };
    }

    // PPCBank redirects the customer back to these after the hosted page; the
    // origin is taken from the live request so dev (:8080) and prod both work.
    const origin = new URL(getRequest().url).origin;
    const charge = await createKhqr({
      orderId: order.id,
      amount: order.total,
      ref: order.payment_ref,
      successURL: `${origin}/pay/${order.id}?return=1`,
      errorURL: `${origin}/pay/${order.id}?failed=1`,
    });

    await db.update(orders).set({ payment_ref: charge.ref }).where(eq(orders.id, order.id));

    return {
      status: "unpaid" as const,
      paymentURL: charge.paymentURL,
      qrString: charge.qrString,
      ref: charge.ref,
      amount: order.total,
      mock: charge.mock,
    };
  });

// Polled by the /pay screen until payment confirms. In real mode this asks
// PPCBank (PMS1024) and flips the order to paid on confirmation; in mock mode it
// just reflects the DB status (set by mockPay).
export const checkPayment = createServerFn({ method: "GET" })
  .inputValidator((d: { orderId: string }) => d)
  .handler(async ({ data }) => {
    const [order] = await getDb()
      .select({
        payment_status: orders.payment_status,
        payment_method: orders.payment_method,
        payment_ref: orders.payment_ref,
        total: orders.total,
      })
      .from(orders)
      .where(eq(orders.id, data.orderId));
    if (!order) throw new Error("Order not found");

    if (
      !paymentMockMode() &&
      order.payment_method === "khqr" &&
      order.payment_status !== "paid" &&
      order.payment_ref
    ) {
      const result = await retrievePaymentResult(order.payment_ref);
      if (result.paid) {
        await markOrderPaid(data.orderId, result.referenceNo ?? order.payment_ref);
        return { status: "paid" as const, amount: order.total };
      }
    }

    return { status: order.payment_status, amount: order.total };
  });

// MOCK ONLY: stands in for a real settlement so the flow is testable before the
// gateway is connected. Disabled the moment real credentials are set.
export const mockPay = createServerFn({ method: "POST" })
  .inputValidator((d: { orderId: string }) => d)
  .handler(async ({ data }) => {
    if (!paymentMockMode()) throw new Error("Mock payment is disabled");
    return markOrderPaid(data.orderId, `MOCK-CONFIRMED-${Date.now()}`);
  });
