-- Phase 1: Create v_user_restaurants view and update RPC functions for security

-- 1.1 Create semantic alias v_user_restaurants (for clarity)
CREATE OR REPLACE VIEW public.v_user_restaurants AS
SELECT 
  user_id,
  centro_id AS restaurant_id,
  centro_code AS restaurant_code,
  centro_nombre AS restaurant_name,
  role,
  orquest_service_id
FROM public.v_user_centres;

-- 1.2 Update get_hours_metrics to validate restaurant access
CREATE OR REPLACE FUNCTION public.get_hours_metrics(
  p_start_date date, 
  p_end_date date, 
  p_centro text DEFAULT NULL
)
RETURNS TABLE(
  horas_planificadas numeric, 
  horas_trabajadas numeric, 
  horas_ausencia numeric, 
  tasa_absentismo numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_user_centros TEXT[];
BEGIN
  v_user_id := auth.uid();
  
  -- Get user's accessible centres from view
  SELECT ARRAY_AGG(DISTINCT centro_code)
  INTO v_user_centros
  FROM v_user_centres
  WHERE user_id = v_user_id;

  -- Validate that requested centro is accessible (if not admin)
  IF p_centro IS NOT NULL 
     AND NOT (p_centro = ANY(v_user_centros)) 
     AND NOT has_role(v_user_id, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied to centro: %', p_centro;
  END IF;

  RETURN QUERY
  WITH schedule_hours AS (
    SELECT COALESCE(SUM(s.horas_planificadas), 0) as total_planificadas
    FROM schedules s
    JOIN employees e ON e.id = s.employee_id
    WHERE s.fecha BETWEEN p_start_date AND p_end_date
      AND (p_centro IS NULL OR e.centro = p_centro)
  ),
  absence_hours AS (
    SELECT COALESCE(SUM(a.horas_ausencia), 0) as total_ausencias
    FROM absences a
    JOIN employees e ON e.id = a.employee_id
    WHERE a.fecha BETWEEN p_start_date AND p_end_date
      AND (p_centro IS NULL OR e.centro = p_centro)
  ),
  worked_hours AS (
    SELECT 
      COALESCE(SUM(sh.horas_planificadas), 0) - COALESCE(SUM(ah.horas_ausencia), 0) as total_trabajadas
    FROM schedules sh
    LEFT JOIN absences ah ON ah.employee_id = sh.employee_id AND ah.fecha = sh.fecha
    JOIN employees e ON e.id = sh.employee_id
    WHERE sh.fecha BETWEEN p_start_date AND p_end_date
      AND (p_centro IS NULL OR e.centro = p_centro)
  )
  SELECT 
    sh.total_planificadas,
    wh.total_trabajadas,
    ah.total_ausencias,
    CASE 
      WHEN sh.total_planificadas > 0 
      THEN ROUND((ah.total_ausencias / sh.total_planificadas * 100), 2)
      ELSE 0
    END as tasa_absentismo
  FROM schedule_hours sh, absence_hours ah, worked_hours wh;
END;
$function$;

-- 1.3 Update get_cost_metrics to validate restaurant access
CREATE OR REPLACE FUNCTION public.get_cost_metrics(
  p_start_date date, 
  p_end_date date, 
  p_centro text DEFAULT NULL
)
RETURNS TABLE(
  coste_total numeric, 
  coste_medio_hora numeric, 
  total_horas numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_user_centros TEXT[];
BEGIN
  v_user_id := auth.uid();
  
  -- Get user's accessible centres from view
  SELECT ARRAY_AGG(DISTINCT centro_code)
  INTO v_user_centros
  FROM v_user_centres
  WHERE user_id = v_user_id;

  -- Validate that requested centro is accessible (if not admin)
  IF p_centro IS NOT NULL 
     AND NOT (p_centro = ANY(v_user_centros)) 
     AND NOT has_role(v_user_id, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied to centro: %', p_centro;
  END IF;

  RETURN QUERY
  SELECT 
    COALESCE(SUM(p.coste_total), 0) as coste_total,
    CASE 
      WHEN SUM(p.horas_trabajadas) > 0 
      THEN ROUND(SUM(p.coste_total) / SUM(p.horas_trabajadas), 2)
      ELSE 0
    END as coste_medio_hora,
    COALESCE(SUM(p.horas_trabajadas), 0) as total_horas
  FROM payrolls p
  JOIN employees e ON e.id = p.employee_id
  WHERE p.periodo_inicio >= p_start_date 
    AND p.periodo_fin <= p_end_date
    AND (p_centro IS NULL OR e.centro = p_centro);
END;
$function$;

-- 1.4 Update get_daily_hours_evolution to validate restaurant access
CREATE OR REPLACE FUNCTION public.get_daily_hours_evolution(
  p_start_date date, 
  p_end_date date, 
  p_centro text DEFAULT NULL
)
RETURNS TABLE(
  fecha date, 
  horas_planificadas numeric, 
  horas_trabajadas numeric, 
  horas_ausencia numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_user_centros TEXT[];
BEGIN
  v_user_id := auth.uid();
  
  -- Get user's accessible centres from view
  SELECT ARRAY_AGG(DISTINCT centro_code)
  INTO v_user_centros
  FROM v_user_centres
  WHERE user_id = v_user_id;

  -- Validate that requested centro is accessible (if not admin)
  IF p_centro IS NOT NULL 
     AND NOT (p_centro = ANY(v_user_centros)) 
     AND NOT has_role(v_user_id, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied to centro: %', p_centro;
  END IF;

  RETURN QUERY
  WITH daily_schedule AS (
    SELECT 
      s.fecha,
      SUM(s.horas_planificadas) as planificadas
    FROM schedules s
    JOIN employees e ON e.id = s.employee_id
    WHERE s.fecha BETWEEN p_start_date AND p_end_date
      AND (p_centro IS NULL OR e.centro = p_centro)
    GROUP BY s.fecha
  ),
  daily_absences AS (
    SELECT 
      a.fecha,
      SUM(a.horas_ausencia) as ausencias
    FROM absences a
    JOIN employees e ON e.id = a.employee_id
    WHERE a.fecha BETWEEN p_start_date AND p_end_date
      AND (p_centro IS NULL OR e.centro = p_centro)
    GROUP BY a.fecha
  )
  SELECT 
    ds.fecha,
    COALESCE(ds.planificadas, 0) as horas_planificadas,
    COALESCE(ds.planificadas, 0) - COALESCE(da.ausencias, 0) as horas_trabajadas,
    COALESCE(da.ausencias, 0) as horas_ausencia
  FROM daily_schedule ds
  LEFT JOIN daily_absences da ON ds.fecha = da.fecha
  ORDER BY ds.fecha;
END;
$function$;

-- 1.5 Update get_metrics_by_service to validate restaurant access
CREATE OR REPLACE FUNCTION public.get_metrics_by_service(
  p_start_date date, 
  p_end_date date, 
  p_centro_code text DEFAULT NULL
)
RETURNS TABLE(
  service_id text, 
  service_descripcion text, 
  horas_planificadas numeric, 
  horas_trabajadas numeric, 
  empleados_activos integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_user_centros TEXT[];
BEGIN
  v_user_id := auth.uid();
  
  -- Get user's accessible centres from view
  SELECT ARRAY_AGG(DISTINCT centro_code)
  INTO v_user_centros
  FROM v_user_centres
  WHERE user_id = v_user_id;

  -- Validate that requested centro is accessible (if not admin)
  IF p_centro_code IS NOT NULL 
     AND NOT (p_centro_code = ANY(v_user_centros)) 
     AND NOT has_role(v_user_id, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied to centro: %', p_centro_code;
  END IF;

  RETURN QUERY
  SELECT 
    rs.orquest_service_id,
    COALESCE(rs.descripcion, rs.orquest_service_id) as service_descripcion,
    COALESCE(SUM(s.horas_planificadas), 0) as horas_planificadas,
    COALESCE(SUM(s.horas_planificadas) - SUM(COALESCE(a.horas_ausencia, 0)), 0) as horas_trabajadas,
    COUNT(DISTINCT e.id)::INTEGER as empleados_activos
  FROM restaurant_services rs
  JOIN centres c ON c.id = rs.centro_id
  JOIN employees e ON e.centro = c.codigo
  LEFT JOIN schedules s ON s.employee_id = e.id 
    AND s.fecha BETWEEN p_start_date AND p_end_date
    AND s.service_id = rs.orquest_service_id
  LEFT JOIN absences a ON a.employee_id = e.id
    AND a.fecha BETWEEN p_start_date AND p_end_date
  WHERE rs.activo = true
    AND c.activo = true
    AND (p_centro_code IS NULL OR c.codigo = p_centro_code)
  GROUP BY rs.orquest_service_id, rs.descripcion
  ORDER BY horas_planificadas DESC;
END;
$function$;