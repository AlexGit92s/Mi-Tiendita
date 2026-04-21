-- ============================================================================
-- Migration 010: Aceptar código corto (APT-XXXXXXXX) en get_reservation_tracking
-- ----------------------------------------------------------------------------
-- Problema UX:
--   La 009 aceptaba sólo UUID completo. El cliente en el ticket sólo ve
--   "APT-3F5E0B4C" (8 primeros chars del UUID), así que pedirle el UUID
--   completo es una mala experiencia.
--
-- Solución:
--   Cambiar la firma a TEXT y aceptar 3 formatos:
--     - UUID completo                 → "3f5e0b4c-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
--     - Código corto 8 hex            → "3f5e0b4c"
--     - Código con prefijo APT-       → "APT-3F5E0B4C" (case-insensitive)
--
--   Para el código corto resolvemos por prefijo de 8 hex sobre id::text.
--   Si hay colisión (>1 coincidencia) devolvemos NULL para no filtrar
--   información de otras reservas.
--
-- Seguridad:
--   La función sigue siendo SECURITY DEFINER y sólo retorna campos públicos
--   (producto, estado, eventos filtrados). No expone customer_name/phone ni
--   eventos internos (ver 009).
-- ============================================================================

BEGIN;

-- DROP requerido: cambiamos la firma (UUID → TEXT).
DROP FUNCTION IF EXISTS public.get_reservation_tracking(UUID);

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
  -- ── 0. Normalización del input ────────────────────────────────────────────
  IF p_code IS NULL THEN
    RETURN NULL;
  END IF;

  -- trim + lowercase + quitar prefijo APT- si viene
  v_normalized := lower(trim(p_code));
  v_normalized := regexp_replace(v_normalized, '^apt-', '');

  -- ── 1. Resolver a un UUID único ───────────────────────────────────────────
  IF v_normalized ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    -- UUID completo
    v_uuid := v_normalized::UUID;
  ELSIF v_normalized ~ '^[0-9a-f]{8}$' THEN
    -- Código corto: buscar por prefijo del UUID
    SELECT COUNT(*) INTO v_match_count
    FROM public.reservations
    WHERE substring(id::text, 1, 8) = v_normalized;

    IF v_match_count <> 1 THEN
      -- Sin match o colisión: no filtramos info, devolvemos NULL.
      RETURN NULL;
    END IF;

    SELECT id INTO v_uuid
    FROM public.reservations
    WHERE substring(id::text, 1, 8) = v_normalized
    LIMIT 1;
  ELSE
    -- Formato inválido
    RETURN NULL;
  END IF;

  -- ── 2. Buscar la reserva ──────────────────────────────────────────────────
  SELECT
    r.id,
    r.status,
    r.created_at,
    r.deposit_confirmed_at,
    r.reservation_date,
    p.name   AS product_name,
    p.images AS product_images
  INTO v_reservation
  FROM public.reservations r
  JOIN public.products      p ON p.id = r.product_id
  WHERE r.id = v_uuid
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- ── 3. Eventos públicos filtrados ─────────────────────────────────────────
  SELECT json_agg(ev ORDER BY ev.created_at ASC)
  INTO v_events
  FROM (
    SELECT
      te.id,
      te.created_at,
      te.event_key,
      CASE te.event_key
        WHEN 'reserva_creada'       THEN 'Reserva recibida'
        WHEN 'deposito_confirmado'  THEN 'Depósito aprobado ✓'
        WHEN 'empaquetado'          THEN 'En preparación'
        WHEN 'en_camino'            THEN 'Tu pedido está en camino'
        WHEN 'entregado'            THEN '¡Entregado!'
        WHEN 'cancelado'            THEN 'Reserva cancelada'
        ELSE te.event_label
      END AS event_label
    FROM public.product_tracking_events te
    WHERE te.reservation_id = v_uuid
      AND te.event_key    != ALL(v_hidden_keys)
      AND te.is_correction = false
  ) ev;

  -- ── 4. Respuesta ──────────────────────────────────────────────────────────
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

-- ============================================================================
-- Smoke test (ejecutar APARTE):
--
--   -- Código corto APT-
--   SELECT public.get_reservation_tracking('APT-3F5E0B4C');
--   -- Sin prefijo
--   SELECT public.get_reservation_tracking('3f5e0b4c');
--   -- UUID completo
--   SELECT public.get_reservation_tracking('3f5e0b4c-aaaa-bbbb-cccc-dddddddddddd');
--   -- Inexistente → NULL
--   SELECT public.get_reservation_tracking('00000000');
-- ============================================================================
