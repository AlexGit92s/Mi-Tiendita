-- ============================================================================
-- Rollback de migration 005
-- ============================================================================

BEGIN;

ALTER TABLE public.reservations
  DROP COLUMN IF EXISTS stock_committed_at,
  DROP COLUMN IF EXISTS stock_committed;

COMMIT;
