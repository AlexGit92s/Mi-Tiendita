-- ============================================================================
-- Rollback de migration 003
-- ADVERTENCIA:
--   - Elimina la tabla de historial y los datos de confirmacion de deposito.
--   - No intenta remover el valor enum `finalizado`, porque Postgres no lo
--     soporta de forma simple/segura en rollback idempotente.
-- ============================================================================

BEGIN;

DROP TABLE IF EXISTS public.product_tracking_events;

ALTER TABLE public.reservations
  DROP COLUMN IF EXISTS deposit_reference,
  DROP COLUMN IF EXISTS deposit_authorization,
  DROP COLUMN IF EXISTS deposit_transferred_by,
  DROP COLUMN IF EXISTS deposit_confirmed_at;

COMMIT;
