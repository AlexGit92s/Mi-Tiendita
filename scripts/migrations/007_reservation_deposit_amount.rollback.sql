BEGIN;

ALTER TABLE public.reservations
  DROP COLUMN IF EXISTS deposit_amount;

COMMIT;
