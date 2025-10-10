-- =====================================================
-- FASE 1: Vista v_user_centres
-- =====================================================
-- Vista que resuelve los centros accesibles por cada usuario
CREATE OR REPLACE VIEW public.v_user_centres AS
SELECT DISTINCT
  ur.user_id,
  c.codigo as centro_code,
  c.id as centro_id,
  c.nombre as centro_nombre,
  c.orquest_service_id,
  ur.role
FROM public.user_roles ur
INNER JOIN public.centres c ON ur.centro = c.codigo
WHERE ur.role = 'gestor'::app_role
UNION ALL
-- Los admins ven todos los centros
SELECT DISTINCT
  ur.user_id,
  c.codigo as centro_code,
  c.id as centro_id,
  c.nombre as centro_nombre,
  c.orquest_service_id,
  'admin'::app_role as role
FROM public.user_roles ur
CROSS JOIN public.centres c
WHERE ur.role = 'admin'::app_role;

COMMENT ON VIEW public.v_user_centres IS 
'Vista que resuelve qué centros puede ver cada usuario. 
Gestores ven solo sus centros asignados en user_roles.centro.
Admins ven todos los centros.';

-- =====================================================
-- FASE 2: Función Helper
-- =====================================================
CREATE OR REPLACE FUNCTION public.user_can_access_centro(
  _user_id uuid, 
  _centro_code text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.v_user_centres 
    WHERE user_id = _user_id 
      AND centro_code = _centro_code
  );
$$;

COMMENT ON FUNCTION public.user_can_access_centro IS
'Verifica si un usuario tiene acceso a un centro específico.
Usa v_user_centres para resolver permisos de admin/gestor.';

-- =====================================================
-- FASE 3: Actualizar Políticas RLS
-- =====================================================

-- 3.1 Employees
DROP POLICY IF EXISTS "Gestores can view employees in their centro" ON public.employees;

CREATE POLICY "Users can view employees in their accessible centres"
ON public.employees FOR SELECT
TO authenticated
USING (
  centro IN (
    SELECT centro_code 
    FROM public.v_user_centres 
    WHERE user_id = auth.uid()
  )
);

-- 3.2 Schedules
DROP POLICY IF EXISTS "Gestores can view schedules for their centro employees" ON public.schedules;

CREATE POLICY "Users can view schedules for their accessible centres"
ON public.schedules FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM public.employees e
    INNER JOIN public.v_user_centres vc 
      ON e.centro = vc.centro_code AND vc.user_id = auth.uid()
    WHERE e.id = schedules.employee_id
  )
);

-- 3.3 Absences
DROP POLICY IF EXISTS "Gestores can view absences for their centro employees" ON public.absences;

CREATE POLICY "Users can view absences for their accessible centres"
ON public.absences FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM public.employees e
    INNER JOIN public.v_user_centres vc 
      ON e.centro = vc.centro_code AND vc.user_id = auth.uid()
    WHERE e.id = absences.employee_id
  )
);

-- 3.4 Payrolls
DROP POLICY IF EXISTS "Gestores can view payrolls for their centro employees" ON public.payrolls;

CREATE POLICY "Users can view payrolls for their accessible centres"
ON public.payrolls FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM public.employees e
    INNER JOIN public.v_user_centres vc 
      ON e.centro = vc.centro_code AND vc.user_id = auth.uid()
    WHERE e.id = payrolls.employee_id
  )
);

-- 3.5 DQ Issues
DROP POLICY IF EXISTS "Gestores can view dq issues for their centro" ON public.dq_issues;

CREATE POLICY "Users can view dq issues for their accessible centres"
ON public.dq_issues FOR SELECT
TO authenticated
USING (
  centro IN (
    SELECT centro_code 
    FROM public.v_user_centres 
    WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Gestores can update dq issues for their centro" ON public.dq_issues;

CREATE POLICY "Users can update dq issues for their accessible centres"
ON public.dq_issues FOR UPDATE
TO authenticated
USING (
  centro IN (
    SELECT centro_code 
    FROM public.v_user_centres 
    WHERE user_id = auth.uid()
  )
);

-- 3.6 Alerts
DROP POLICY IF EXISTS "Gestores can view alerts for their centro" ON public.alerts;

CREATE POLICY "Users can view alerts for their accessible centres"
ON public.alerts FOR SELECT
TO authenticated
USING (
  centro IS NULL 
  OR centro IN (
    SELECT centro_code 
    FROM public.v_user_centres 
    WHERE user_id = auth.uid()
  )
);

-- =====================================================
-- FASE 4: Actualizar Funciones SQL
-- =====================================================

-- 4.1 get_payroll_costs
CREATE OR REPLACE FUNCTION public.get_payroll_costs(p_start_date date, p_end_date date, p_centro text DEFAULT NULL::text)
 RETURNS TABLE(employee_id uuid, employee_name text, employee_centro text, horas_trabajadas numeric, horas_vacaciones numeric, horas_formacion numeric, coste_total numeric, coste_medio numeric)
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

  RETURN QUERY
  SELECT 
    e.id as employee_id,
    (e.nombre || ' ' || e.apellidos) as employee_name,
    e.centro as employee_centro,
    COALESCE(SUM(p.horas_trabajadas), 0) as horas_trabajadas,
    COALESCE(SUM(p.horas_vacaciones), 0) as horas_vacaciones,
    COALESCE(SUM(p.horas_formacion), 0) as horas_formacion,
    COALESCE(SUM(p.coste_total), 0) as coste_total,
    CASE 
      WHEN SUM(p.horas_trabajadas) > 0 
      THEN ROUND(SUM(p.coste_total) / SUM(p.horas_trabajadas), 2)
      ELSE 0
    END as coste_medio
  FROM employees e
  LEFT JOIN payrolls p ON p.employee_id = e.id
    AND p.periodo_inicio >= p_start_date 
    AND p.periodo_fin <= p_end_date
  WHERE 
    -- User can only see their accessible centros
    e.centro = ANY(v_user_centros)
    -- Apply centro filter if provided
    AND (p_centro IS NULL OR e.centro = p_centro)
  GROUP BY e.id, e.nombre, e.apellidos, e.centro
  HAVING SUM(p.coste_total) > 0
  ORDER BY e.apellidos, e.nombre;
END;
$function$;

-- 4.2 get_planned_vs_actual_costs
CREATE OR REPLACE FUNCTION public.get_planned_vs_actual_costs(p_start_date date, p_end_date date, p_centro text DEFAULT NULL::text)
 RETURNS TABLE(centro text, costes_planificados numeric, costes_reales numeric)
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

  RETURN QUERY
  WITH planned_costs AS (
    SELECT 
      e.centro,
      SUM(s.horas_planificadas) as total_horas_planificadas,
      AVG(p.coste_total / NULLIF(p.horas_trabajadas, 0)) as coste_medio_hora
    FROM schedules s
    JOIN employees e ON e.id = s.employee_id
    LEFT JOIN payrolls p ON p.employee_id = e.id
    WHERE s.fecha BETWEEN p_start_date AND p_end_date
      AND e.centro = ANY(v_user_centros)
      AND (p_centro IS NULL OR e.centro = p_centro)
    GROUP BY e.centro
  ),
  actual_costs AS (
    SELECT 
      e.centro,
      SUM(p.coste_total) as total_coste_real
    FROM payrolls p
    JOIN employees e ON e.id = p.employee_id
    WHERE p.periodo_inicio >= p_start_date 
      AND p.periodo_fin <= p_end_date
      AND e.centro = ANY(v_user_centros)
      AND (p_centro IS NULL OR e.centro = p_centro)
    GROUP BY e.centro
  )
  SELECT 
    COALESCE(pc.centro, ac.centro) as centro,
    COALESCE(ROUND(pc.total_horas_planificadas * pc.coste_medio_hora, 2), 0) as costes_planificados,
    COALESCE(ac.total_coste_real, 0) as costes_reales
  FROM planned_costs pc
  FULL OUTER JOIN actual_costs ac ON pc.centro = ac.centro
  WHERE COALESCE(pc.centro, ac.centro) IS NOT NULL
  ORDER BY COALESCE(pc.centro, ac.centro);
END;
$function$;

-- =====================================================
-- FASE 5: Índices para Optimización
-- =====================================================

-- Índice en user_roles para JOIN rápido
CREATE INDEX IF NOT EXISTS idx_user_roles_user_centro 
ON public.user_roles(user_id, centro) 
WHERE role = 'gestor'::app_role;

-- Índice en employees.centro para filtros
CREATE INDEX IF NOT EXISTS idx_employees_centro 
ON public.employees(centro);

-- Índice en centres.codigo (probablemente ya existe como unique)
CREATE INDEX IF NOT EXISTS idx_centres_codigo 
ON public.centres(codigo);