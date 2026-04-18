-- ============================================================================
-- Rollback de migration 001
-- ADVERTENCIA: borra las columnas añadidas y sus datos. Hacer backup antes.
-- ============================================================================

BEGIN;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_category_id_fkey;

DROP INDEX IF EXISTS public.idx_products_category_id;

ALTER TABLE public.products
  DROP COLUMN IF EXISTS description,
  DROP COLUMN IF EXISTS category_id,
  DROP COLUMN IF EXISTS is_limited_edition;

COMMIT;

