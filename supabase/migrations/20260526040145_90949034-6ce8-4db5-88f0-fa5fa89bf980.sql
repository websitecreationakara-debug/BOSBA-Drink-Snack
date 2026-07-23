
-- Profiles: restrict public read to owner-only
DROP POLICY IF EXISTS "Profiles public read" ON public.profiles;
CREATE POLICY "Users view own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Orders: require authenticated user matching user_id
DROP POLICY IF EXISTS "Users create own orders" ON public.orders;
CREATE POLICY "Users create own orders" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

ALTER TABLE public.orders ALTER COLUMN user_id SET NOT NULL;

-- user_roles: only admins may insert/update/delete
CREATE POLICY "Admins insert roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
