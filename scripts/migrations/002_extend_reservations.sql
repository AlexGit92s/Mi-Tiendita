-- ============================================================================
-- Migration 002: extend reservations table
-- ----------------------------------------------------------------------------
-- Motivo: el carrito (shopping-cart) envía campos que no existen en la tabla
-- `reservations`. Esta migración añade los campos faltantes y corrige el uso
-- del enum `reservation_status` desde el frontend.
--
-- Cambios:
--   + customer_email    TEXT (nullable — no siempre se pide)
--   + reservation_date  DATE (nullable — fecha tentativa de pickup/entrega)
--   + notes             TEXT (nullable — notas del cliente)
--   + fee_paid          BOOLEAN NOT NULL DEFAULT false (anticipo pagado)
--
-- Nota sobre status:
--   El enum reservation_status ya usa valores en español:
--     'pendiente' | 'pagado' | 'entregado' | 'cancelado'
--   El frontend enviaba 'pending' (inglés). El fix es en el código
--   del cliente — el schema no cambia.
--
-- Seguridad / compat:
--   - IF NOT EXISTS en cada ADD COLUMN → re-ejecutable sin error.
--   - RLS existente cubre los nuevos campos.
-- ============================================================================

BEGIN;

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS customer_email    TEXT,
  ADD COLUMN IF NOT EXISTS reservation_date  DATE,
  ADD COLUMN IF NOT EXISTS notes             TEXT,
  ADD COLUMN IF NOT EXISTS fee_paid          BOOLEAN NOT NULL DEFAULT false;

-- Validación: debe salir algo como 4 columnas nuevas + las originales.
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'reservations'
ORDER BY ordinal_position;

COMMIT;
