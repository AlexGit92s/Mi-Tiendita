  -- ============================================================================
  -- Rollback de Migration 006: policies RLS para apartado público
  -- ----------------------------------------------------------------------------
  -- Quita las policies granulares y restaura la policy permisiva previa
  -- (`Enable all for ...`) que deja todo abierto — útil solo si se necesita
  -- volver al estado de desarrollo documentado en supabase-schema.sql.
  -- ============================================================================

  BEGIN;

  DROP POLICY IF EXISTS "Reservations insert public"         ON public.reservations;
  DROP POLICY IF EXISTS "Reservations select authenticated"  ON public.reservations;
  DROP POLICY IF EXISTS "Reservations update authenticated"  ON public.reservations;
  DROP POLICY IF EXISTS "Reservations delete authenticated"  ON public.reservations;

  CREATE POLICY "Enable all for reservations"
    ON public.reservations
    FOR ALL
    USING (true)
    WITH CHECK (true);

  DO $$
  BEGIN
    IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'product_tracking_events'
    ) THEN
      EXECUTE 'DROP POLICY IF EXISTS "Tracking insert public"        ON public.product_tracking_events';
      EXECUTE 'DROP POLICY IF EXISTS "Tracking select authenticated" ON public.product_tracking_events';
      EXECUTE 'DROP POLICY IF EXISTS "Tracking update authenticated" ON public.product_tracking_events';
      EXECUTE 'DROP POLICY IF EXISTS "Tracking delete authenticated" ON public.product_tracking_events';

      EXECUTE $p$
        CREATE POLICY "Enable all for product tracking events"
          ON public.product_tracking_events
          FOR ALL
          USING (true)
          WITH CHECK (true)
      $p$;
    END IF;
  END $$;

  COMMIT;
