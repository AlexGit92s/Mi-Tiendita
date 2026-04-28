-- ============================================================================
-- Migration 012: desligar apartados cerrados/cancelados de productos
-- ----------------------------------------------------------------------------
-- Motivo: un apartado historico puede seguir bloqueando DELETE en products por
-- FK, aunque ya este cancelado/finalizado. Esta migracion permite conservar el
-- historial administrativo sin obligar a que el producto exista para siempre.
--
-- Cambios:
--   - reservations.product_id queda nullable y su FK pasa a ON DELETE SET NULL.
--   - product_tracking_events.product_id queda nullable y su FK pasa a
--     ON DELETE SET NULL.
--
-- Resultado:
--   - Apartados activos pueden seguir ligados a producto.
--   - Apartados cancelados/anulados pueden desligarse desde la app.
--   - Si se borra un producto, los historiales existentes no bloquean el DELETE.
-- ============================================================================

BEGIN;

ALTER TABLE public.reservations
  ALTER COLUMN product_id DROP NOT NULL;

ALTER TABLE public.reservations
  DROP CONSTRAINT IF EXISTS reservations_product_id_fkey;

ALTER TABLE public.reservations
  ADD CONSTRAINT reservations_product_id_fkey
  FOREIGN KEY (product_id)
  REFERENCES public.products(id)
  ON DELETE SET NULL;

DO $$
BEGIN
  IF to_regclass('public.product_tracking_events') IS NOT NULL THEN
    ALTER TABLE public.product_tracking_events
      ALTER COLUMN product_id DROP NOT NULL;

    ALTER TABLE public.product_tracking_events
      DROP CONSTRAINT IF EXISTS product_tracking_events_product_id_fkey;

    ALTER TABLE public.product_tracking_events
      ADD CONSTRAINT product_tracking_events_product_id_fkey
      FOREIGN KEY (product_id)
      REFERENCES public.products(id)
      ON DELETE SET NULL;
  END IF;
END $$;

UPDATE public.reservations
SET product_id = NULL
WHERE status::text IN ('cancelado', 'anulado')
  AND product_id IS NOT NULL;

SELECT
  tc.table_name,
  tc.constraint_name,
  rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.referential_constraints rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name IN ('reservations', 'product_tracking_events')
  AND tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name, tc.constraint_name;

COMMIT;
