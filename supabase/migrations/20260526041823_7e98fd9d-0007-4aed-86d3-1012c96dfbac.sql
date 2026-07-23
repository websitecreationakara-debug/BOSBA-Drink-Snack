
DROP POLICY IF EXISTS "Products public read" ON public.products;
CREATE POLICY "Products published read" ON public.products
  FOR SELECT TO anon, authenticated
  USING (status = 'published');
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO anon, authenticated;
