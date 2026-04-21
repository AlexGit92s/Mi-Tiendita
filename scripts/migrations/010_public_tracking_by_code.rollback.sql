-- Rollback 010: volver a la firma UUID (restaura la versión de 009)
BEGIN;

DROP FUNCTION IF EXISTS public.get_reservation_tracking(TEXT);

-- Re-crear versión UUID (idéntica a 009)
CREATE OR REPLACE FUNCTION public.get_reservation_tracking(
  p_reservation_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reservation RECORD;
  v_events      JSON;
  v_hidden_keys TEXT[] := ARRAY[
    'correccion_administrativa',
    'deposito_revertido',
    'estado_reserva'
  ];
BEGIN
  SELECT
    r.id, r.status, r.created_at, r.deposit_confirmed_at, r.reservation_date,
    p.name AS product_name, p.images AS product_images
  INTO v_reservation
  FROM public.reservations r
  JOIN public.products      p ON p.id = r.product_id
  WHERE r.id = p_reservation_id
  LIMIT 1;

  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT json_agg(ev ORDER BY ev.created_at ASC) INTO v_events
  FROM (
    SELECT te.id, te.created_at, te.event_key,
      CASE te.event_key
        WHEN 'reserva_creada'      THEN 'Reserva recibida'
        WHEN 'deposito_confirmado' THEN 'Depósito aprobado ✓'
        WHEN 'empaquetado'         THEN 'En preparación'
        WHEN 'en_camino'           THEN 'Tu pedido está en camino'
        WHEN 'entregado'           THEN '¡Entregado!'
        WHEN 'cancelado'           THEN 'Reserva cancelada'
        ELSE te.event_label
      END AS event_label
    FROM public.product_tracking_events te
    WHERE te.reservation_id = p_reservation_id
      AND te.event_key    != ALL(v_hidden_keys)
      AND te.is_correction = false
  ) ev;

  RETURN json_build_object(
    'id', v_reservation.id,
    'status', v_reservation.status,
    'created_at', v_reservation.created_at,
    'deposit_confirmed_at', v_reservation.deposit_confirmed_at,
    'reservation_date', v_reservation.reservation_date,
    'product_name', v_reservation.product_name,
    'product_images', v_reservation.product_images,
    'events', COALESCE(v_events, '[]'::json)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_reservation_tracking(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_reservation_tracking(UUID) TO authenticated;

COMMIT;
