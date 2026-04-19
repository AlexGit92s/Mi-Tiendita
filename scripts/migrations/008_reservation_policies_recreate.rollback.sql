-- ============================================================================
-- Rollback de Migration 008: recreación de policies RLS
-- ----------------------------------------------------------------------------
-- Elimina las policies recreadas por 008. Tras este rollback, el estado queda
-- equivalente al observado durante el diagnóstico (RLS habilitado + cero
-- policies = deny-by-default). Solo usar si se va a reaplicar 006 o un script
-- equivalente inmediatamente después.
-- ============================================================================

BEGIN;

DROP POLICY IF EXISTS "reservations_insert_public" ON public.reservations;
DROP POLICY IF EXISTS "reservations_select_auth"   ON public.reservations;
DROP POLICY IF EXISTS "reservations_update_auth"   ON public.reservations;
DROP POLICY IF EXISTS "reservations_delete_auth"   ON public.reservations;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'product_tracking_events'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "tracking_insert_public" ON public.product_tracking_events';
    EXECUTE 'DROP POLICY IF EXISTS "tracking_select_auth"   ON public.product_tracking_events';
    EXECUTE 'DROP POLICY IF EXISTS "tracking_update_auth"   ON public.product_tracking_events';
    EXECUTE 'DROP POLICY IF EXISTS "tracking_delete_auth"   ON public.product_tracking_events';
  END IF;
END $$;

COMMIT;
