-- ============================================================================
-- Migration 006: policies RLS para apartado público
-- ----------------------------------------------------------------------------
-- Motivo: el carrito del catálogo público (cliente no autenticado, rol `anon`)
-- falla al crear una reserva con:
--   "new row violates row-level security policy for table reservations"
--
-- Causa: las policies desplegadas en Supabase están limitando el INSERT a
-- usuarios `authenticated`, pero el flujo de apartado lo ejecuta un visitante
-- sin sesión. Esta migración realinea las policies con lo documentado en
-- CLAUDE.md §4:
--   reservations              → SELECT/UPDATE/DELETE authenticated, INSERT público
--   product_tracking_events   → INSERT público (ligado a la reserva pública)
--                               SELECT/UPDATE/DELETE authenticated
--
-- Seguridad:
--   - El público solo puede INSERTAR reservas y su evento inicial de tracking.
--     No puede leerlas, modificarlas ni borrarlas (eso sigue siendo admin).
--   - No se desactiva RLS en ningún momento.
--   - WITH CHECK (true) es seguro porque la tabla no expone secretos y los
--     campos `status/fee_paid/deposit_*` los sobreescribe el admin al confirmar.
--
-- Idempotencia: todas las policies se DROP IF EXISTS antes de recrearse.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- reservations
-- ---------------------------------------------------------------------------
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

-- Limpieza de posibles variantes previas (schema viejo + manuales de dashboard)
DROP POLICY IF EXISTS "Enable all for reservations"          ON public.reservations;
DROP POLICY IF EXISTS "Public can create reservations"       ON public.reservations;
DROP POLICY IF EXISTS "Public can view reservations"         ON public.reservations;
DROP POLICY IF EXISTS "Reservations insert public"           ON public.reservations;
DROP POLICY IF EXISTS "Reservations select authenticated"    ON public.reservations;
DROP POLICY IF EXISTS "Reservations update authenticated"    ON public.reservations;
DROP POLICY IF EXISTS "Reservations delete authenticated"    ON public.reservations;

CREATE POLICY "Reservations insert public"
  ON public.reservations
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Reservations select authenticated"
  ON public.reservations
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Reservations update authenticated"
  ON public.reservations
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Reservations delete authenticated"
  ON public.reservations
  FOR DELETE
  TO authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- product_tracking_events (creado en migración 003)
-- El carrito inserta el evento `reserva_creada` justo después del insert de la
-- reserva. Si la tabla no existe (migración 003 no aplicada), se omite.
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

    EXECUTE $p$
      CREATE POLICY "Tracking insert public"
        ON public.product_tracking_events
        FOR INSERT
        TO anon, authenticated
        WITH CHECK (true)
    $p$;

    EXECUTE $p$
      CREATE POLICY "Tracking select authenticated"
        ON public.product_tracking_events
        FOR SELECT
        TO authenticated
        USING (true)
    $p$;

    EXECUTE $p$
      CREATE POLICY "Tracking update authenticated"
        ON public.product_tracking_events
        FOR UPDATE
        TO authenticated
        USING (true)
        WITH CHECK (true)
    $p$;

    EXECUTE $p$
      CREATE POLICY "Tracking delete authenticated"
        ON public.product_tracking_events
        FOR DELETE
        TO authenticated
        USING (true)
    $p$;
  END IF;
END $$;

-- Validación: listar policies resultantes
SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('reservations', 'product_tracking_events')
ORDER BY tablename, policyname;

COMMIT;
