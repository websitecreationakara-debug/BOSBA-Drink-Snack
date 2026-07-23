
-- Roles enum + table
CREATE TYPE public.app_role AS ENUM ('admin','customer');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'customer',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(),'admin'));

-- Profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles public read" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Categories
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Categories public read" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Admins manage categories" ON public.categories FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Products
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  price numeric(10,2) NOT NULL DEFAULT 0,
  sale_price numeric(10,2),
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  stock integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'published',
  image_url text,
  badge text,
  rating numeric(2,1) DEFAULT 4.5,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Products public read" ON public.products FOR SELECT USING (status = 'published' OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage products" ON public.products FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Orders
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  total numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own orders" ON public.orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own orders" ON public.orders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all orders" ON public.orders FOR SELECT USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update orders" ON public.orders FOR UPDATE USING (public.has_role(auth.uid(),'admin'));

-- Store settings (singleton)
CREATE TABLE public.store_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  banner_text text DEFAULT 'Free delivery on orders over $30',
  global_discount_pct numeric(5,2) DEFAULT 0,
  free_shipping_threshold numeric(10,2) DEFAULT 30,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Settings public read" ON public.store_settings FOR SELECT USING (true);
CREATE POLICY "Admins manage settings" ON public.store_settings FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Auto-updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_settings_updated BEFORE UPDATE ON public.store_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Profile + customer role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'customer');
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Seed
INSERT INTO public.store_settings DEFAULT VALUES;
INSERT INTO public.categories (name, slug) VALUES
  ('Fresh Produce','produce'),
  ('Fruits','fruits'),
  ('Leafy Greens','greens'),
  ('Dairy & Eggs','dairy'),
  ('Bakery','bakery'),
  ('Pantry','pantry');

INSERT INTO public.products (title, description, price, sale_price, stock, badge, image_url, category_id) VALUES
  ('Organic Haas Avocado','Creamy, ripe, perfect for toast.',3.50,2.49,120,'SALE','https://images.unsplash.com/photo-1519162808019-7de1683fa2ad?w=600',(SELECT id FROM public.categories WHERE slug='fruits')),
  ('Heirloom Tomatoes','Vine-ripened, full of flavor.',5.20,NULL,80,'ORGANIC','https://images.unsplash.com/photo-1546470427-227df1e3d2e0?w=600',(SELECT id FROM public.categories WHERE slug='produce')),
  ('Lacinato Kale','Dark, leafy, nutrient-dense.',3.25,NULL,60,'NEW','https://images.unsplash.com/photo-1515356956015-d342c9c14fa3?w=600',(SELECT id FROM public.categories WHERE slug='greens')),
  ('Wild Forest Honey','Raw, unfiltered, local.',14.00,11.99,40,'HOT','https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=600',(SELECT id FROM public.categories WHERE slug='pantry')),
  ('Summer Strawberries','Sweet, juicy, freshly picked.',5.99,4.20,90,'SALE','https://images.unsplash.com/photo-1464965911861-746a04b4bca6?w=600',(SELECT id FROM public.categories WHERE slug='fruits')),
  ('Artisan Sourdough','Wild yeast, crusty crust.',8.00,NULL,30,NULL,'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600',(SELECT id FROM public.categories WHERE slug='bakery')),
  ('Almond Milk','Cold-pressed, unsweetened.',6.90,NULL,75,'NEW','https://images.unsplash.com/photo-1626078436904-d24e91f44953?w=600',(SELECT id FROM public.categories WHERE slug='dairy')),
  ('Chioggia Beets','Golden striped heirloom.',4.50,NULL,55,NULL,'https://images.unsplash.com/photo-1593105544559-ecb03bf76f82?w=600',(SELECT id FROM public.categories WHERE slug='produce'));
