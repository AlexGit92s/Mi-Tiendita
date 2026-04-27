-- ============================================================================
-- Migration 011: recrear policies RLS para products
-- ----------------------------------------------------------------------------
-- Motivo: el panel admin puede listar productos, pero el DELETE puede no afectar
-- filas si la tabla `products` tiene RLS habilitado sin policy de borrado para
-- usuarios autenticados. Esta migracion deja la matriz esperada:
--
--   products -> SELECT anon + authenticated
--            -> INSERT/UPDATE/DELETE authenticated
--
-- Seguridad: el catalogo publico conserva solo lectura. Crear, editar y borrar
-- productos queda limitado al rol authenticated.
-- ============================================================================

BEGIN;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all for products"        ON public.products;
DROP POLICY IF EXISTS "Public can view products"       ON public.products;
DROP POLICY IF EXISTS "Products select public"         ON public.products;
DROP POLICY IF EXISTS "Products insert authenticated"  ON public.products;
DROP POLICY IF EXISTS "Products update authenticated"  ON public.products;
DROP POLICY IF EXISTS "Products delete authenticated"  ON public.products;
DROP POLICY IF EXISTS "products_select_public"         ON public.products;
DROP POLICY IF EXISTS "products_insert_auth"           ON public.products;
DROP POLICY IF EXISTS "products_update_auth"           ON public.products;
DROP POLICY IF EXISTS "products_delete_auth"           ON public.products;

CREATE POLICY "products_select_public"
  ON public.products
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "products_insert_auth"
  ON public.products
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "products_update_auth"
  ON public.products
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "products_delete_auth"
  ON public.products
  FOR DELETE
  TO authenticated
  USING (true);

SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'products'
ORDER BY policyname;

COMMIT;
