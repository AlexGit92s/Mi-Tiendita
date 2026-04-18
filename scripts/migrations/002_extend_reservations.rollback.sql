-- ============================================================================
-- Rollback de migration 002
-- ADVERTENCIA: borra las columnas añadidas y sus datos.
-- ============================================================================

BEGIN;

ALTER TABLE public.reservations
  DROP COLUMN IF EXISTS customer_email,
  DROP COLUMN IF EXISTS reservation_date,
  DROP COLUMN IF EXISTS notes,
  DROP COLUMN IF EXISTS fee_paid;

COMMIT;
