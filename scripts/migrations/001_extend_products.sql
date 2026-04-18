-- ============================================================================
-- Migration 001: extend products table
-- ----------------------------------------------------------------------------
-- Motivo: el formulario del admin (product-form) envía campos que no existen
-- en la tabla `products`. Esta migración añade los campos faltantes y conecta
-- `products` con la tabla `categories` via FK. Los campos `stock` e `images`
-- se mantienen; el form será ajustado para usar los nombres correctos.
--
-- Cambios:
--   + description        TEXT (nullable)
--   + category_id        UUID FK → categories(id) ON DELETE SET NULL
--   + is_limited_edition BOOLEAN NOT NULL DEFAULT false
--
-- Seguridad / compat:
--   - Usa IF NOT EXISTS: puede re-ejecutarse sin error.
--   - `category` (TEXT) se mantiene para no romper datos existentes.
--   - Backfill opcional de category_id buscando coincidencia por nombre.
--   - RLS existente no se toca — las policies ya cubren los nuevos campos.
-- ============================================================================

BEGIN;

-- 1. Añadir columnas nuevas (idempotente)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS category_id UUID,
  ADD COLUMN IF NOT EXISTS is_limited_edition BOOLEAN NOT NULL DEFAULT false;

-- 2. Añadir FK a categories (solo si no existe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'products_category_id_fkey'
      AND table_name = 'products'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_category_id_fkey
      FOREIGN KEY (category_id)
      REFERENCES public.categories(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Índice para joins rápidos
CREATE INDEX IF NOT EXISTS idx_products_category_id
  ON public.products(category_id);

-- 4. Backfill: intenta rellenar category_id desde la columna `category` (TEXT)
--    buscando coincidencia exacta por nombre en `categories.name`.
--    Seguro: solo actualiza filas donde category_id es NULL.
UPDATE public.products p
SET category_id = c.id
FROM public.categories c
WHERE p.category_id IS NULL
  AND p.category IS NOT NULL
  AND lower(trim(p.category)) = lower(trim(c.name));

-- 5. Validación (ejecuta y revisa antes de cerrar transacción)
--    Si los conteos se ven raros, hacer ROLLBACK.
SELECT
  count(*)                                    AS total_products,
  count(category_id)                          AS with_category_fk,
  count(*) FILTER (WHERE is_limited_edition)  AS limited_edition,
  count(description)                          AS with_description
FROM public.products;

COMMIT;

-- ============================================================================
-- Post-migración: el form debe enviar
--   { name, description, category_id, price, stock, images: [url],
--     is_limited_edition, sizes: [], status: 'disponible' }
-- La columna `category` (TEXT) queda legacy — el frontend puede ignorarla
-- y derivar el nombre desde el JOIN con `categories`.
-- ============================================================================
