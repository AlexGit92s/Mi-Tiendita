-- ============================================================================
-- Migration 008: recrear policies RLS para reservations + tracking
-- ----------------------------------------------------------------------------
-- Motivo: durante el diagnóstico del bloqueo RLS posterior a la migración 006
-- se detectó que `pg_policies` quedó vacío para `reservations` y
-- `product_tracking_events`. Con RLS habilitado + cero policies, Postgres
-- aplica deny-by-default y el apartado público vuelve a fallar con:
--   "new row violates row-level security policy for table reservations"
--
-- Esta migración recrea el set completo de policies documentado en CLAUDE.md §4
-- de forma idempotente (DROP IF EXISTS + CREATE) para dejar el entorno alineado
-- con el schema de referencia.
--
-- Matriz resultante:
--   reservations              → INSERT  anon + authenticated
--                             → SELECT/UPDATE/DELETE  authenticated
--   product_tracking_events   → INSERT  anon + authenticated
--                             → SELECT/UPDATE/DELETE  authenticated
--
-- Seguridad: el público sigue sin poder leer, actualizar ni borrar reservas;
-- solo puede insertar su propia reserva y el evento inicial de tracking.
-- RLS nunca se desactiva.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- reservations
-- ---------------------------------------------------------------------------
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all for reservations"          ON public.reservations;
DROP POLICY IF EXISTS "Public can create reservations"       ON public.reservations;
DROP POLICY IF EXISTS "Public can view reservations"         ON public.reservations;
DROP POLICY IF EXISTS "Reservations insert public"           ON public.reservations;
DROP POLICY IF EXISTS "Reservations select authenticated"    ON public.reservations;
DROP POLICY IF EXISTS "Reservations update authenticated"    ON public.reservations;
DROP POLICY IF EXISTS "Reservations delete authenticated"    ON public.reservations;
DROP POLICY IF EXISTS "reservations_insert_public"           ON public.reservations;
DROP POLICY IF EXISTS "reservations_select_auth"             ON public.reservations;
DROP POLICY IF EXISTS "reservations_update_auth"             ON public.reservations;
DROP POLICY IF EXISTS "reservations_delete_auth"             ON public.reservations;

CREATE POLICY "reservations_insert_public"
  ON public.reservations
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "reservations_select_auth"
  ON public.reservations
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "reservations_update_auth"
  ON public.reservations
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "reservations_delete_auth"
  ON public.reservations
  FOR DELETE
  TO authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- product_tracking_events (migración 003)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'product_tracking_events'
  ) THEN
    EXECUTE 'ALTER TABLE public.product_tracking_events ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "Enable all for product tracking events" ON public.product_tracking_events';
    EXECUTE 'DROP POLICY IF EXISTS "Tracking insert public"                 ON public.product_tracking_events';
    EXECUTE 'DROP POLICY IF EXISTS "Tracking select authenticated"          ON public.product_tracking_events';
    EXECUTE 'DROP POLICY IF EXISTS "Tracking update authenticated"          ON public.product_tracking_events';
    EXECUTE 'DROP POLICY IF EXISTS "Tracking delete authenticated"          ON public.product_tracking_events';
    EXECUTE 'DROP POLICY IF EXISTS "tracking_insert_public"                 ON public.product_tracking_events';
    EXECUTE 'DROP POLICY IF EXISTS "tracking_select_auth"                   ON public.product_tracking_events';
    EXECUTE 'DROP POLICY IF EXISTS "tracking_update_auth"                   ON public.product_tracking_events';
    EXECUTE 'DROP POLICY IF EXISTS "tracking_delete_auth"                   ON public.product_tracking_events';

    EXECUTE $p$
      CREATE POLICY "tracking_insert_public"
        ON public.product_tracking_events
        FOR INSERT
        TO anon, authenticated
        WITH CHECK (true)
    $p$;

    EXECUTE $p$
      CREATE POLICY "tracking_select_auth"
        ON public.product_tracking_events
        FOR SELECT
        TO authenticated
        USING (true)
    $p$;

    EXECUTE $p$
      CREATE POLICY "tracking_update_auth"
        ON public.product_tracking_events
        FOR UPDATE
        TO authenticated
        USING (true)
        WITH CHECK (true)
    $p$;

    EXECUTE $p$
      CREATE POLICY "tracking_delete_auth"
        ON public.product_tracking_events
        FOR DELETE
        TO authenticated
        USING (true)
    $p$;
  END IF;
END $$;

-- Validación: policies activas tras la recreación
SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('reservations', 'product_tracking_events')
ORDER BY tablename, policyname;

COMMIT;

-- ----------------------------------------------------------------------------
-- Smoke test (ejecutar aparte en el SQL Editor para confirmar INSERT anon):
--
--   BEGIN;
--   SET LOCAL ROLE anon;
--   INSERT INTO public.reservations (product_id, customer_name, customer_phone)
--   VALUES ((SELECT id FROM public.products LIMIT 1), 'smoke test', '+504 0000-0000')
--   RETURNING id;
--   ROLLBACK;
-- ----------------------------------------------------------------------------
