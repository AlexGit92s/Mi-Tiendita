  -- ============================================================================
  -- Migration 004: correction metadata for product tracking history
  -- ----------------------------------------------------------------------------
  -- Agrega campos para marcar eventos corregidos sin reescribir el pasado.
  -- ============================================================================

  BEGIN;

  ALTER TABLE public.product_tracking_events
    ADD COLUMN IF NOT EXISTS is_correction      BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS correction_reason  TEXT,
    ADD COLUMN IF NOT EXISTS corrected_event_id UUID NULL REFERENCES public.product_tracking_events(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS actor_email        TEXT;

  CREATE INDEX IF NOT EXISTS idx_product_tracking_events_correction
    ON public.product_tracking_events(is_correction, created_at DESC);

  SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'product_tracking_events'
    AND column_name IN (
      'is_correction',
      'correction_reason',
      'corrected_event_id',
      'actor_email'
    )
  ORDER BY column_name;

  COMMIT;
