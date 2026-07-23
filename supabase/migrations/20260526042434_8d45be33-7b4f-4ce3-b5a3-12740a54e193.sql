
DROP POLICY IF EXISTS "Users create own orders" ON public.orders;
CREATE POLICY "Users create own orders" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id AND status = 'pending');

DROP POLICY IF EXISTS "Admins view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users view own roles" ON public.user_roles;
CREATE POLICY "Admins view all roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
