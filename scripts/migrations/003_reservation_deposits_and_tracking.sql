-- ============================================================================
-- Migration 003: reservation deposits + product tracking history
-- ----------------------------------------------------------------------------
-- Agrega:
--   + status adicional `finalizado` en reservation_status (si existe el enum)
--   + campos de confirmacion de deposito en reservations
--   + tabla public.product_tracking_events para historial de seguimiento
--
-- Casos de uso:
--   - Confirmar deposito con referencia/autorizacion y nombre de quien transfiere
--   - Guardar eventos como: vendido, empaquetado, en camino, recibido,
--     cerrado_pagado, cerrado_devuelto y otros
--   - Asociar eventos a una reserva o a un producto sin reserva
-- ============================================================================

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typnamespace = 'public'::regnamespace
      AND typname = 'reservation_status'
  ) THEN
    ALTER TYPE public.reservation_status ADD VALUE IF NOT EXISTS 'finalizado';
  END IF;
END $$;

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS deposit_reference      TEXT,
  ADD COLUMN IF NOT EXISTS deposit_authorization  TEXT,
  ADD COLUMN IF NOT EXISTS deposit_transferred_by TEXT,
  ADD COLUMN IF NOT EXISTS deposit_confirmed_at   TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.product_tracking_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  reservation_id UUID NULL REFERENCES public.reservations(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  event_key TEXT NOT NULL,
  event_label TEXT NOT NULL,
  notes TEXT NULL,
  metadata JSONB NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_product_tracking_events_product_id
  ON public.product_tracking_events(product_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_tracking_events_reservation_id
  ON public.product_tracking_events(reservation_id, created_at DESC);

ALTER TABLE public.product_tracking_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all for product tracking events" ON public.product_tracking_events;
CREATE POLICY "Enable all for product tracking events"
  ON public.product_tracking_events
  FOR ALL
  USING (true)
  WITH CHECK (true);

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'reservations'
  AND column_name IN (
    'deposit_reference',
    'deposit_authorization',
    'deposit_transferred_by',
    'deposit_confirmed_at'
  )
ORDER BY column_name;

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'product_tracking_events';

COMMIT;
