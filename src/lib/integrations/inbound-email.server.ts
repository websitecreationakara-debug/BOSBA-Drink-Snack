// Inbound half of the customer chat: Cloudflare Email Routing hands every email
// sent to the sales mailbox to the Worker's email() handler (src/server.ts).
// A reply is attached to the order it's about and shown in the admin Orders chat.
import PostalMime from "postal-mime";
import { and, desc, eq, like, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { orders, order_messages } from "@/db/schema";

// Structural subset of Cloudflare's ForwardableEmailMessage (what we actually use).
export type InboundEmail = {
  from: string;
  raw: ReadableStream<Uint8Array>;
  rawSize: number;
  forward(to: string): Promise<void>;
};

const MAX_RAW_BYTES = 2 * 1024 * 1024;
const MAX_BODY_CHARS = 5000;

// Drops the quoted original ("On … wrote:", "> …", Outlook headers) so the chat
// shows only what the customer actually typed.
function stripQuoted(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const kept: string[] = [];
  for (const line of lines) {
    if (/^On .+wrote:\s*$/i.test(line) || /^-{2,}\s*Original Message\s*-{2,}/i.test(line)) break;
    if (/^From:\s.+/.test(line) && kept.length > 0 && kept[kept.length - 1] === "") break;
    if (line.startsWith(">")) continue;
    kept.push(line);
  }
  return kept.join("\n").trim();
}

export async function handleInboundEmail(message: InboundEmail, forwardTo?: string): Promise<void> {
  try {
    if (message.rawSize <= MAX_RAW_BYTES) {
      const parsed = await PostalMime.parse(await new Response(message.raw).arrayBuffer());
      const auto = parsed.headers.find((h) => h.key === "auto-submitted")?.value;
      const sender = (parsed.from?.address ?? message.from).trim().toLowerCase();
      if (sender && (!auto || auto.trim().toLowerCase() === "no")) {
        const subject = parsed.subject ?? "";
        const body = stripQuoted(parsed.text ?? "").slice(0, MAX_BODY_CHARS);
        const db = getDb();
        const bySender = eq(sql`lower(${orders.customer_email})`, sender);
        // Prefer the order tagged in the subject ("[#1a2b3c4d]"); fall back to
        // the sender's most recent order. The sender must own the order either way.
        const tag = subject.match(/#([0-9a-f]{8})\b/i)?.[1]?.toLowerCase();
        let order = tag
          ? (
              await db
                .select({ id: orders.id })
                .from(orders)
                .where(and(like(orders.id, `${tag}%`), bySender))
                .limit(1)
            )[0]
          : undefined;
        order ??= (
          await db
            .select({ id: orders.id })
            .from(orders)
            .where(bySender)
            .orderBy(desc(orders.created_at))
            .limit(1)
        )[0];
        if (order && body) {
          await db.insert(order_messages).values({
            order_id: order.id,
            direction: "in",
            subject: subject || null,
            body,
            sender,
          });
        }
      }
    }
  } catch (e) {
    console.error("[inbound-email] failed to store reply", e);
  }
  // Optional copy to a real mailbox (must be a verified Email Routing destination).
  if (forwardTo) {
    try {
      await message.forward(forwardTo);
    } catch (e) {
      console.error("[inbound-email] forward failed", e);
    }
  }
}
