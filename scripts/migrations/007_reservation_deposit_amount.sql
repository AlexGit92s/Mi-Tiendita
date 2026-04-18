-- ============================================================================
-- Migration 007: monto transferido para apartados
-- ----------------------------------------------------------------------------
-- Reemplaza el uso operativo de autorizacion por un monto real transferido,
-- para distinguir anticipo parcial de pago completo.
-- ============================================================================

BEGIN;

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC(10,2) NOT NULL DEFAULT 0;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'reservations'
  AND column_name IN ('deposit_amount')
ORDER BY column_name;

COMMIT;
