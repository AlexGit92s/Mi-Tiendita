-- Rollback de migration 012.
-- Requiere que no existan reservations/product_tracking_events con product_id NULL.

BEGIN;

ALTER TABLE public.reservations
  DROP CONSTRAINT IF EXISTS reservations_product_id_fkey;

ALTER TABLE public.reservations
  ALTER COLUMN product_id SET NOT NULL;

ALTER TABLE public.reservations
  ADD CONSTRAINT reservations_product_id_fkey
  FOREIGN KEY (product_id)
  REFERENCES public.products(id)
  ON DELETE RESTRICT;

DO $$
BEGIN
  IF to_regclass('public.product_tracking_events') IS NOT NULL THEN
    ALTER TABLE public.product_tracking_events
      DROP CONSTRAINT IF EXISTS product_tracking_events_product_id_fkey;

    ALTER TABLE public.product_tracking_events
      ALTER COLUMN product_id SET NOT NULL;

    ALTER TABLE public.product_tracking_events
      ADD CONSTRAINT product_tracking_events_product_id_fkey
      FOREIGN KEY (product_id)
      REFERENCES public.products(id)
      ON DELETE CASCADE;
  END IF;
END $$;

COMMIT;
