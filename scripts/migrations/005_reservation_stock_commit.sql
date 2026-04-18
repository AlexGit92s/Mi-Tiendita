  -- ============================================================================
  -- Migration 005: stock allocation state for reservations
  -- ----------------------------------------------------------------------------
  -- Guarda si una reserva ya comprometio stock por eventos operativos.
  -- ============================================================================

  BEGIN;

  ALTER TABLE public.reservations
    ADD COLUMN IF NOT EXISTS stock_committed    BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS stock_committed_at TIMESTAMPTZ;

  SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'reservations'
    AND column_name IN ('stock_committed', 'stock_committed_at')
  ORDER BY column_name;

  COMMIT;
