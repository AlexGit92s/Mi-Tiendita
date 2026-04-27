-- Rollback de migration 011: restaura la policy permisiva historica de demo.
-- Usar solo si se necesita volver al comportamiento anterior.

BEGIN;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "products_select_public" ON public.products;
DROP POLICY IF EXISTS "products_insert_auth"   ON public.products;
DROP POLICY IF EXISTS "products_update_auth"   ON public.products;
DROP POLICY IF EXISTS "products_delete_auth"   ON public.products;

CREATE POLICY "Enable all for products"
  ON public.products
  FOR ALL
  USING (true)
  WITH CHECK (true);

COMMIT;
