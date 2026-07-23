import { sqliteTable, text, integer, real, blob } from "drizzle-orm/sqlite-core";

const uuid = () => crypto.randomUUID();
const nowIso = () => new Date().toISOString();

// ---------- Application tables ----------
// Column names are snake_case to match the frontend types in src/lib/types.ts,
// so query results can flow straight to the UI without remapping.

export const categories = sqliteTable("categories", {
  id: text("id").primaryKey().$defaultFn(uuid),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  image_url: text("image_url"),
  // Self-reference for parent/child hierarchy; null = top-level category.
  parent_id: text("parent_id"),
  created_at: text("created_at").notNull().$defaultFn(nowIso),
});

export const hero_slides = sqliteTable("hero_slides", {
  id: text("id").primaryKey().$defaultFn(uuid),
  eyebrow: text("eyebrow"),
  title_top: text("title_top"),
  title_accent: text("title_accent"),
  title_bottom: text("title_bottom"),
  body: text("body"),
  image_url: text("image_url"),
  cta_label: text("cta_label"),
  cta_link: text("cta_link").notNull().default("/shop"),
  sort_order: integer("sort_order").notNull().default(0),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  created_at: text("created_at").notNull().$defaultFn(nowIso),
});

// Marketing campaigns / offers. A product points at one promotion; while the
// promotion is active and within its date window, the product is featured in
// that offer's storefront section and (if discount_pct is set) sells at a
// discount. Dates are ISO YYYY-MM-DD; null bound = open-ended on that side.
export const promotions = sqliteTable("promotions", {
  id: text("id").primaryKey().$defaultFn(uuid),
  name: text("name").notNull(),
  // "limited" | "seasonal" | "special" — drives the badge label/styling.
  kind: text("kind").notNull().default("special"),
  description: text("description"),
  // Percent off assigned products while live. Null/0 = featured grouping only.
  discount_pct: real("discount_pct"),
  starts_at: text("starts_at"),
  ends_at: text("ends_at"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  sort_order: integer("sort_order").notNull().default(0),
  created_at: text("created_at").notNull().$defaultFn(nowIso),
});

export const products = sqliteTable("products", {
  id: text("id").primaryKey().$defaultFn(uuid),
  title: text("title").notNull(),
  description: text("description"),
  price: real("price").notNull().default(0),
  sale_price: real("sale_price"),
  category_id: text("category_id").references(() => categories.id, { onDelete: "set null" }),
  // null = stock untracked (always available); a number = tracked count (0 = out of stock).
  stock: integer("stock"),
  status: text("status").notNull().default("published"),
  image_url: text("image_url"),
  badge: text("badge"),
  rating: real("rating").default(4.5),
  weight: text("weight"),
  // Pieces per box/package, when the product is sold by count. Null = N/A.
  pcs: integer("pcs"),
  // "simple" | "variable". A variable product is a container: its own price and
  // stock are ignored and the purchasable options live in product_variations.
  type: text("type").notNull().default("simple"),
  // Manual display order (admin drag-to-reorder). Lower = earlier. Ties break by created_at.
  sort_order: integer("sort_order").notNull().default(0),
  // Optional marketing offer this product belongs to. Cleared if the promotion is deleted.
  promotion_id: text("promotion_id").references(() => promotions.id, { onDelete: "set null" }),
  created_at: text("created_at").notNull().$defaultFn(nowIso),
  updated_at: text("updated_at").notNull().$defaultFn(nowIso),
});

// Extra gallery photos shown under the main image on the product page. The
// cover image stays on products.image_url; these are the additional angles.
export const product_images = sqliteTable("product_images", {
  id: text("id").primaryKey().$defaultFn(uuid),
  product_id: text("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  sort_order: integer("sort_order").notNull().default(0),
  created_at: text("created_at").notNull().$defaultFn(nowIso),
});

export const product_variations = sqliteTable("product_variations", {
  id: text("id").primaryKey().$defaultFn(uuid),
  product_id: text("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  // Variation label — the weight, e.g. "250g", "1kg".
  weight: text("weight").notNull(),
  price: real("price").notNull().default(0),
  sale_price: real("sale_price"),
  // null = stock untracked (always available); a number = tracked count (0 = out of stock).
  stock: integer("stock"),
  // Pieces per box for this weight, when sold by count. Null = N/A.
  pcs: integer("pcs"),
  sort_order: integer("sort_order").notNull().default(0),
  created_at: text("created_at").notNull().$defaultFn(nowIso),
});

// Checkout discount codes (managed under Marketing). A code is either a percent
// or a fixed-amount discount, toggled on/off via `active`.
export const promo_codes = sqliteTable("promo_codes", {
  id: text("id").primaryKey().$defaultFn(uuid),
  code: text("code").notNull().unique(),
  // "percent" | "fixed"
  type: text("type").notNull().default("percent"),
  value: real("value").notNull().default(0),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  created_at: text("created_at").notNull().$defaultFn(nowIso),
});

export const media = sqliteTable("media", {
  id: text("id").primaryKey().$defaultFn(uuid),
  key: text("key").notNull().unique(),
  url: text("url").notNull(),
  filename: text("filename").notNull(),
  content_type: text("content_type"),
  size: integer("size").notNull().default(0),
  // Image bytes live in D1 (no R2). Kept nullable so the column adds cleanly via ALTER.
  data: blob("data", { mode: "buffer" }),
  created_at: text("created_at").notNull().$defaultFn(nowIso),
});

export const orders = sqliteTable("orders", {
  id: text("id").primaryKey().$defaultFn(uuid),
  // Nullable: guest checkout creates orders with no associated account.
  user_id: text("user_id"),
  // Customer contact + delivery captured at checkout. Nullable so the columns
  // add cleanly via ALTER to pre-existing rows.
  customer_name: text("customer_name"),
  customer_email: text("customer_email"),
  customer_phone: text("customer_phone"),
  location_lat: real("location_lat"),
  location_lng: real("location_lng"),
  address: text("address"),
  city: text("city"),
  postal_code: text("postal_code"),
  // JSON array of line items, stored as text (parsed/stringified in the app layer).
  items: text("items").notNull().default("[]"),
  status: text("status").notNull().default("pending"),
  // Courier tracking link (e.g. a Grab delivery URL), set by staff when shipping.
  tracking_url: text("tracking_url"),
  // Promo code applied at checkout and the dollar amount it took off, if any.
  promo_code: text("promo_code"),
  discount: real("discount").notNull().default(0),
  // Optional customer-chosen delivery/pre-order time (datetime-local string). Null = ASAP.
  scheduled_at: text("scheduled_at"),
  // "delivery" | "pickup" (customer collects in-store — no delivery fee, no address needed).
  delivery_method: text("delivery_method").notNull().default("delivery"),
  // "cod" (cash on delivery) | "khqr" (pay online via the KHQR gateway).
  payment_method: text("payment_method").notNull().default("cod"),
  // "unpaid" | "paid". COD orders stay unpaid until delivery; KHQR orders flip to
  // paid only once the gateway confirms (webhook), which is when the store is notified.
  payment_status: text("payment_status").notNull().default("unpaid"),
  // Gateway transaction reference, used to match a payment callback to its order.
  payment_ref: text("payment_ref"),
  paid_at: text("paid_at"),
  total: real("total").notNull(),
  created_at: text("created_at").notNull().$defaultFn(nowIso),
});

// Saved delivery addresses for logged-in customers (address book), so repeat
// buyers don't re-type at checkout. Fields mirror the delivery block captured on
// orders. Every row belongs to a user — guests never create these. Exactly one
// address per user is the default (invariant maintained in src/data/addresses.ts).
export const addresses = sqliteTable("addresses", {
  id: text("id").primaryKey().$defaultFn(uuid),
  user_id: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  // Optional short name for the address, e.g. "Home", "Office".
  label: text("label"),
  recipient_name: text("recipient_name"),
  phone: text("phone"),
  address: text("address").notNull(),
  city: text("city"),
  location_lat: real("location_lat"),
  location_lng: real("location_lng"),
  is_default: integer("is_default", { mode: "boolean" }).notNull().default(false),
  created_at: text("created_at").notNull().$defaultFn(nowIso),
});

export const store_settings = sqliteTable("store_settings", {
  id: text("id").primaryKey().$defaultFn(uuid),
  banner_text: text("banner_text"),
  global_discount_pct: real("global_discount_pct").default(0),
  free_shipping_threshold: real("free_shipping_threshold").default(30),
  updated_at: text("updated_at").notNull().$defaultFn(nowIso),
});

// ---------- better-auth tables ----------
// Shapes follow better-auth's drizzle (sqlite) conventions, including the
// `admin` plugin fields (user.role/banned/..., session.impersonatedBy).

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  phone: text("phone"),
  role: text("role"),
  banned: integer("banned", { mode: "boolean" }),
  banReason: text("ban_reason"),
  banExpires: integer("ban_expires", { mode: "timestamp" }),
  // Set once a user has completed TOTP two-factor setup (better-auth twoFactor
  // plugin). When true, sign-in requires an authenticator code.
  twoFactorEnabled: integer("two_factor_enabled", { mode: "boolean" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// Rate-limit counters for better-auth's database-backed limiter. Property names
// (key/count/lastRequest) must match better-auth's model fields; rows are
// keyed per client IP + path and auto-pruned by better-auth once stale.
export const rateLimit = sqliteTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").unique(),
  count: integer("count"),
  lastRequest: integer("last_request"),
});

// TOTP secret + backup codes for the better-auth twoFactor plugin. One row per
// user with 2FA enabled. Secret/backupCodes are never returned to the client.
export const twoFactor = sqliteTable("two_factor", {
  id: text("id").primaryKey(),
  secret: text("secret").notNull(),
  backupCodes: text("backup_codes").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  verified: integer("verified", { mode: "boolean" }),
  failedVerificationCount: integer("failed_verification_count"),
  lockedUntil: integer("locked_until", { mode: "timestamp" }),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  impersonatedBy: text("impersonated_by"),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp" }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});
