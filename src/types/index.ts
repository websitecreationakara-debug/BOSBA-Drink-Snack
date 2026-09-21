export type Product = {
  id: string;
  title: string;
  description: string | null;
  price: number;
  sale_price: number | null;
  category_id: string | null;
  stock: number | null;
  status: string;
  image_url: string | null;
  badge: string | null;
  rating: number | null;
  weight: string | null;
  pcs: number | null;
  type: string;
  sort_order: number;
  featured: boolean;
  pre_order: boolean;
  promotion_id: string | null;
  // Optional YouTube link shown as an autoplaying clip in the product gallery.
  video_url: string | null;
  created_at: string;
  updated_at: string;
};

export type PromotionKind = "limited" | "seasonal" | "special";

export type Promotion = {
  id: string;
  name: string;
  kind: PromotionKind;
  description: string | null;
  discount_pct: number | null;
  starts_at: string | null;
  ends_at: string | null;
  active: boolean;
  sort_order: number;
  created_at: string;
};

export type ProductImage = {
  id: string;
  product_id: string;
  url: string;
  sort_order: number;
  created_at: string;
};

export type ProductTab = {
  id: string;
  product_id: string;
  title: string;
  body: string;
  sort_order: number;
  created_at: string;
};

export type ProductVariation = {
  id: string;
  product_id: string;
  weight: string;
  flavor: string | null;
  price: number;
  sale_price: number | null;
  stock: number | null;
  pcs: number | null;
  sort_order: number;
  image_url: string | null;
  created_at: string;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  parent_id: string | null;
  created_at: string;
};

export type HeroSlide = {
  id: string;
  eyebrow: string | null;
  title_top: string | null;
  title_accent: string | null;
  title_bottom: string | null;
  body: string | null;
  image_url: string | null;
  cta_label: string | null;
  cta_link: string;
  sort_order: number;
  active: boolean;
  created_at: string;
};

export type PromoCode = {
  id: string;
  code: string;
  type: string;
  value: number;
  active: boolean;
  created_at: string;
};

export type Media = {
  id: string;
  key: string;
  url: string;
  filename: string;
  content_type: string | null;
  size: number;
  created_at: string;
};

export type CartItem = {
  product: Product;
  variation: ProductVariation | null;
  qty: number;
};

export type SocialPlatform = "facebook" | "instagram" | "telegram" | "tiktok";

// Hand-pasted credentials for each platform -- no OAuth connect flow. A
// platform counts as "connected" when its required fields are non-empty (see
// socialPlatformConnected in src/data/social.ts).
export type SocialSettings = {
  facebook_page_id: string;
  facebook_page_access_token: string;
  instagram_business_account_id: string;
  telegram_bot_token: string;
  telegram_channel_id: string;
  tiktok_access_token: string;
  tiktok_post_visibility: "private" | "public";
  updated_at: string;
};

export type SocialPostTarget = {
  id: string;
  platform: SocialPlatform;
  status: "success" | "failed";
  remote_post_id: string | null;
  error: string | null;
};

export type SocialPost = {
  id: string;
  product_id: string | null;
  product_title: string;
  image_url: string | null;
  caption: string;
  extra_note: string | null;
  status: "queued" | "published" | "failed";
  scheduled_for: string;
  platforms: string | null;
  created_at: string;
  published_at: string | null;
  targets: SocialPostTarget[];
};

export type OrderItem = { id: string; title: string; qty: number; price: number };

export type Order = {
  id: string;
  user_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  location_lat: number | null;
  location_lng: number | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  items: OrderItem[];
  status: string;
  tracking_url: string | null;
  promo_code: string | null;
  discount: number;
  scheduled_at: string | null;
  delivery_method: string;
  payment_method: string;
  payment_status: string;
  payment_ref: string | null;
  paid_at: string | null;
  total: number;
  created_at: string;
};

export type Address = {
  id: string;
  user_id: string;
  label: string | null;
  recipient_name: string | null;
  phone: string | null;
  address: string;
  city: string | null;
  location_lat: number | null;
  location_lng: number | null;
  is_default: boolean;
  created_at: string;
};

export type StoreSettings = {
  id: string;
  banner_text: string | null;
  global_discount_pct: number | null;
  free_shipping_threshold: number | null;
  updated_at: string;
};
