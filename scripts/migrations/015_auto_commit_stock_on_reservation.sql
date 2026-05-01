-- ============================================================================
-- Migration 015: descontar stock automaticamente al crear un apartado
-- ----------------------------------------------------------------------------
-- Motivo:
--   Hasta ahora el stock de `products` solo se descontaba cuando el admin
--   validaba el pago (ReservationsComponent.confirmDeposit -> applyStockAction).
--   Con la nueva regla "el cliente debe declarar transferencia >= 50% al
--   apartar", el apartado ya es un compromiso real y debe reducir el stock
--   visible al instante, no esperar a que un admin lo valide.
--
--   El carrito publico inserta como rol `anon`, que por RLS no puede hacer
--   UPDATE sobre `products`. Por eso el descuento se hace con un trigger
--   SECURITY DEFINER que corre con privilegios del owner.
--
-- Comportamiento:
--   * Trigger BEFORE INSERT en `reservations` con product_id NOT NULL y
--     status en ('pendiente','pagado').
--   * Decrementa products.stock en 1 (clamp a 0) y marca la reserva como
--     stock_committed = true antes de persistirla.
--   * Si el cliente del admin (ReservationsComponent) intenta volver a
--     comprometer stock, applyStockAction() ya respeta stock_committed=true
--     y omite el descuento, asi que NO hay doble decremento.
--   * La cancelacion sigue liberando el stock via applyStockAction('release').
--
-- Seguridad:
--   * SECURITY DEFINER + search_path fijo a public para evitar shadowing.
--   * El trigger no permite UPDATE/DELETE arbitrario, solo decrementa stock.
--   * No expone funciones nuevas al publico; solo dispara con INSERT existente.
--
-- Idempotencia:
--   * DROP TRIGGER IF EXISTS antes de CREATE TRIGGER.
--   * CREATE OR REPLACE FUNCTION.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.handle_reservation_stock_commit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.product_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status NOT IN ('pendiente', 'pagado') THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.stock_committed, false) THEN
    RETURN NEW;
  END IF;

  UPDATE public.products
     SET stock = GREATEST(0, COALESCE(stock, 0) - 1)
   WHERE id = NEW.product_id;

  NEW.stock_committed := true;
  NEW.stock_committed_at := timezone('utc', now());

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reservation_stock_commit ON public.reservations;

CREATE TRIGGER reservation_stock_commit
  BEFORE INSERT ON public.reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_reservation_stock_commit();

-- Smoke verification: el trigger debe figurar en pg_trigger.
SELECT tgname, tgrelid::regclass AS target_table, tgenabled
FROM pg_trigger
WHERE tgname = 'reservation_stock_commit';

COMMIT;
