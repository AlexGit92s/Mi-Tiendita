-- ============================================================================
-- Migration 009: RPC pública para seguimiento de reserva por cliente (anon)
-- ----------------------------------------------------------------------------
-- Problema que resuelve:
--   El rol `anon` no tiene policy SELECT sobre `reservations` ni sobre
--   `product_tracking_events` (correctamente bloqueado por RLS). Sin embargo,
--   queremos que el cliente pueda consultar el estado de SU propia reserva
--   si conoce el UUID.
--
-- Solución: función SECURITY DEFINER que actúa de guardián:
--   anon → ejecuta RPC → función corre como owner (bypasses RLS) →
--   filtra sólo los campos/eventos seguros → retorna resultado al cliente
--
-- Eventos filtrados (nunca visibles al público):
--   correccion_administrativa, deposito_revertido, estado_reserva
--   is_correction = true  (cualquier evento marcado como corrección interna)
--
-- Renombrado en capa SQL (event_key → label público):
--   reserva_creada        → Reserva recibida
--   deposito_confirmado   → Depósito aprobado ✓
--   empaquetado           → En preparación
--   en_camino             → Tu pedido está en camino
--   entregado             → ¡Entregado!
--   cancelado             → Reserva cancelada
--   (otros)               → el event_label original de la tabla
--
-- Seguridad:
--   - SECURITY DEFINER: la función lee con privilegios del owner, no del caller.
--   - SET search_path = public: previene path-hijacking.
--   - GRANT EXECUTE TO anon: sólo permite llamar la función, no las tablas.
--   - La función no expone notas internas, actor_email, correction_reason,
--     corrected_event_id ni metadata sensible.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Función principal
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_reservation_tracking(
  p_reservation_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reservation  RECORD;
  v_events       JSON;
  v_result       JSON;

  -- Claves de eventos que NO deben mostrarse al cliente
  v_hidden_keys  TEXT[] := ARRAY[
    'correccion_administrativa',
    'deposito_revertido',
    'estado_reserva'
  ];
BEGIN
  -- ── 1. Buscar la reserva ──────────────────────────────────────────────────
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
  WHERE r.id = p_reservation_id
  LIMIT 1;

  -- Si no existe la reserva, devolvemos null
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- ── 2. Obtener eventos públicos filtrados ─────────────────────────────────
  SELECT json_agg(ev ORDER BY ev.created_at ASC)
  INTO v_events
  FROM (
    SELECT
      te.id,
      te.created_at,
      te.event_key,
      -- Renombramos el label para el cliente; si no hay mapeo, usamos el original
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
    WHERE te.reservation_id = p_reservation_id
      AND te.event_key    != ALL(v_hidden_keys)
      AND te.is_correction = false   -- ocultar correcciones internas
  ) ev;

  -- ── 3. Construir respuesta ────────────────────────────────────────────────
  v_result := json_build_object(
    'id',                   v_reservation.id,
    'status',               v_reservation.status,
    'created_at',           v_reservation.created_at,
    'deposit_confirmed_at', v_reservation.deposit_confirmed_at,
    'reservation_date',     v_reservation.reservation_date,
    'product_name',         v_reservation.product_name,
    'product_images',       v_reservation.product_images,
    'events',               COALESCE(v_events, '[]'::json)
  );

  RETURN v_result;
END;
$$;

-- ---------------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------------
-- El rol anon puede ejecutar la función (vía REST/supabase-js rpc())
GRANT EXECUTE ON FUNCTION public.get_reservation_tracking(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_reservation_tracking(UUID) TO authenticated;

-- Hardening adicional: asegurar que anon NO legea las tablas directamente.
-- Si ya estaba revocado (por RLS), estas líneas son idempotentes.
REVOKE SELECT ON TABLE public.product_tracking_events FROM anon;
REVOKE SELECT ON TABLE public.reservations             FROM anon;

-- ---------------------------------------------------------------------------
-- Validación
-- ---------------------------------------------------------------------------
SELECT
  proname,
  prosecdef,  -- debe ser TRUE (SECURITY DEFINER)
  proowner::regrole::text AS owner
FROM pg_proc
WHERE proname = 'get_reservation_tracking'
  AND pronamespace = 'public'::regnamespace;

COMMIT;

-- ============================================================================
-- Smoke test (ejecutar APARTE en el SQL Editor):
--
--   -- Con un UUID real de la tabla reservations:
--   SELECT public.get_reservation_tracking('<uuid-real>'::uuid);
--
--   -- UUID inexistente → debe devolver NULL (no error):
--   SELECT public.get_reservation_tracking('00000000-0000-0000-0000-000000000000'::uuid);
--
--   -- Verificar que anon NO puede leer la tabla directo:
--   SET LOCAL ROLE anon;
--   SELECT * FROM public.product_tracking_events LIMIT 1;  -- debe fallar con RLS
--   RESET ROLE;
-- ============================================================================
