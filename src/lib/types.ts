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
  promotion_id: string | null;
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

export type ProductVariation = {
  id: string;
  product_id: string;
  weight: string;
  price: number;
  sale_price: number | null;
  stock: number | null;
  pcs: number | null;
  sort_order: number;
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
