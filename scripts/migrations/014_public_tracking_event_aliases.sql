-- ============================================================================
-- Migration 014: Alinear eventos publicos de seguimiento con eventos admin
-- ----------------------------------------------------------------------------
-- Motivo:
--   El admin historicamente guardaba eventos como `recibido`,
--   `cerrado_pagado` y `cerrado_devuelto`, mientras la vista publica esperaba
--   `entregado`, `finalizado` y `cancelado`. Eso podia dejar el timeline del
--   cliente visualmente detenido en "Deposito aprobado".
--
--   Ademas, cuando un apartado cancelado se desligaba del producto, el JOIN
--   contra products podia hacer que la RPC ya no devolviera la reserva.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.get_reservation_tracking(
  p_code TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_normalized  TEXT;
  v_uuid        UUID;
  v_match_count INT;
  v_reservation RECORD;
  v_events      JSON;

  v_hidden_keys TEXT[] := ARRAY[
    'correccion_administrativa',
    'deposito_revertido',
    'estado_reserva'
  ];
BEGIN
  IF p_code IS NULL THEN
    RETURN NULL;
  END IF;

  v_normalized := lower(trim(p_code));
  v_normalized := regexp_replace(v_normalized, '^apt-', '');

  IF v_normalized ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    v_uuid := v_normalized::UUID;
  ELSIF v_normalized ~ '^[0-9a-f]{8}$' THEN
    SELECT COUNT(*) INTO v_match_count
    FROM public.reservations
    WHERE substring(id::text, 1, 8) = v_normalized;

    IF v_match_count <> 1 THEN
      RETURN NULL;
    END IF;

    SELECT id INTO v_uuid
    FROM public.reservations
    WHERE substring(id::text, 1, 8) = v_normalized
    LIMIT 1;
  ELSE
    RETURN NULL;
  END IF;

  SELECT
    r.id,
    r.status,
    r.created_at,
    r.deposit_confirmed_at,
    r.reservation_date,
    COALESCE(p.name, 'Producto no disponible') AS product_name,
    COALESCE(p.images, ARRAY[]::TEXT[])        AS product_images
  INTO v_reservation
  FROM public.reservations r
  LEFT JOIN public.products p ON p.id = r.product_id
  WHERE r.id = v_uuid
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT json_agg(ev ORDER BY ev.created_at ASC)
  INTO v_events
  FROM (
    SELECT
      te.id,
      te.created_at,
      CASE te.event_key
        WHEN 'recibido'         THEN 'entregado'
        WHEN 'cerrado_devuelto' THEN 'cancelado'
        WHEN 'cerrado_pagado'   THEN 'finalizado'
        ELSE te.event_key
      END AS event_key,
      CASE te.event_key
        WHEN 'reserva_creada'       THEN 'Reserva recibida'
        WHEN 'deposito_confirmado'  THEN 'Deposito aprobado'
        WHEN 'empaquetado'          THEN 'En preparacion'
        WHEN 'en_camino'            THEN 'Tu pedido esta en camino'
        WHEN 'recibido'             THEN 'Entregado'
        WHEN 'entregado'            THEN 'Entregado'
        WHEN 'cerrado_devuelto'     THEN 'Reserva cancelada'
        WHEN 'cancelado'            THEN 'Reserva cancelada'
        WHEN 'cerrado_pagado'       THEN 'Venta finalizada'
        WHEN 'finalizado'           THEN 'Venta finalizada'
        ELSE te.event_label
      END AS event_label
    FROM public.product_tracking_events te
    WHERE te.reservation_id = v_uuid
      AND te.event_key    != ALL(v_hidden_keys)
      AND te.is_correction = false
  ) ev;

  RETURN json_build_object(
    'id',                   v_reservation.id,
    'status',               v_reservation.status,
    'created_at',           v_reservation.created_at,
    'deposit_confirmed_at', v_reservation.deposit_confirmed_at,
    'reservation_date',     v_reservation.reservation_date,
    'product_name',         v_reservation.product_name,
    'product_images',       v_reservation.product_images,
    'events',               COALESCE(v_events, '[]'::json)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_reservation_tracking(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_reservation_tracking(TEXT) TO authenticated;

COMMIT;
