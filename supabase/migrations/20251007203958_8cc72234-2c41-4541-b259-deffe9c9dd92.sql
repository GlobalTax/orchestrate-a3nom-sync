-- Función para calcular métricas de horas planificadas vs trabajadas
CREATE OR REPLACE FUNCTION public.get_hours_metrics(
  p_start_date date,
  p_end_date date,
  p_centro text DEFAULT NULL
)
RETURNS TABLE (
  horas_planificadas numeric,
  horas_trabajadas numeric,
  horas_ausencia numeric,
  tasa_absentismo numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
$$;

-- Función para calcular métricas de costes
CREATE OR REPLACE FUNCTION public.get_cost_metrics(
  p_start_date date,
  p_end_date date,
  p_centro text DEFAULT NULL
)
RETURNS TABLE (
  coste_total numeric,
  coste_medio_hora numeric,
  total_horas numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
$$;

-- Función para obtener evolución diaria de horas
CREATE OR REPLACE FUNCTION public.get_daily_hours_evolution(
  p_start_date date,
  p_end_date date,
  p_centro text DEFAULT NULL
)
RETURNS TABLE (
  fecha date,
  horas_planificadas numeric,
  horas_trabajadas numeric,
  horas_ausencia numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
$$;

-- Función para obtener lista de centros únicos
CREATE OR REPLACE FUNCTION public.get_centros()
RETURNS TABLE (centro text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT e.centro
  FROM employees e
  WHERE e.centro IS NOT NULL
  ORDER BY e.centro;
$$;