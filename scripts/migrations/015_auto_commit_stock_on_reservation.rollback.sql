-- ============================================================================
-- Rollback Migration 015: quitar trigger de descuento automatico de stock
-- ----------------------------------------------------------------------------
-- Restaura el comportamiento previo (stock se descuenta solo desde el admin
-- via ReservationsComponent.confirmDeposit / addTrackingEvent).
-- ============================================================================

BEGIN;

DROP TRIGGER IF EXISTS reservation_stock_commit ON public.reservations;
DROP FUNCTION IF EXISTS public.handle_reservation_stock_commit();

COMMIT;
