-- ============================================================================
-- Rollback de migration 004
-- ADVERTENCIA: elimina metadata de correcciones del historial.
-- ============================================================================

BEGIN;

DROP INDEX IF EXISTS public.idx_product_tracking_events_correction;

ALTER TABLE public.product_tracking_events
  DROP COLUMN IF EXISTS actor_email,
  DROP COLUMN IF EXISTS corrected_event_id,
  DROP COLUMN IF EXISTS correction_reason,
  DROP COLUMN IF EXISTS is_correction;

COMMIT;
