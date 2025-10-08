-- Create centres table
CREATE TABLE public.centres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  direccion TEXT,
  ciudad TEXT,
  pais TEXT DEFAULT 'España',
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indices for centres
CREATE INDEX idx_centres_codigo ON public.centres(codigo);
CREATE INDEX idx_centres_activo ON public.centres(activo);

-- Enable RLS on centres
ALTER TABLE public.centres ENABLE ROW LEVEL SECURITY;

-- RLS Policies for centres
CREATE POLICY "Users can view centres they have access to"
ON public.centres FOR SELECT
USING (
  codigo IN (
    SELECT ur.centro FROM user_roles ur 
    WHERE ur.user_id = auth.uid()
  ) OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can manage all centres"
ON public.centres FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Migrate existing centro data from employees
INSERT INTO public.centres (codigo, nombre)
SELECT DISTINCT centro, centro
FROM employees
WHERE centro IS NOT NULL AND centro != ''
ON CONFLICT (codigo) DO NOTHING;

-- Update get_payroll_costs to filter by user's centros
CREATE OR REPLACE FUNCTION public.get_payroll_costs(
  p_start_date DATE,
  p_end_date DATE,
  p_centro TEXT DEFAULT NULL
)
RETURNS TABLE(
  employee_id UUID,
  employee_name TEXT,
  employee_centro TEXT,
  horas_trabajadas NUMERIC,
  horas_vacaciones NUMERIC,
  horas_formacion NUMERIC,
  coste_total NUMERIC,
  coste_medio NUMERIC
) AS $$
DECLARE
  v_user_id UUID;
  v_is_admin BOOLEAN;
  v_user_centros TEXT[];
BEGIN
  v_user_id := auth.uid();
  
  -- Check if user is admin
  v_is_admin := has_role(v_user_id, 'admin'::app_role);
  
  -- Get user's centros if they are a gestor
  IF NOT v_is_admin THEN
    SELECT ARRAY_AGG(DISTINCT centro)
    INTO v_user_centros
    FROM user_roles
    WHERE user_id = v_user_id 
      AND role = 'gestor'::app_role
      AND centro IS NOT NULL;
  END IF;

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
    -- Admin sees all, gestor only sees their centros
    (v_is_admin OR e.centro = ANY(v_user_centros))
    -- Apply centro filter if provided
    AND (p_centro IS NULL OR e.centro = p_centro)
  GROUP BY e.id, e.nombre, e.apellidos, e.centro
  HAVING SUM(p.coste_total) > 0
  ORDER BY e.apellidos, e.nombre;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update get_planned_vs_actual_costs to filter by user's centros
CREATE OR REPLACE FUNCTION public.get_planned_vs_actual_costs(
  p_start_date DATE,
  p_end_date DATE,
  p_centro TEXT DEFAULT NULL
)
RETURNS TABLE(
  centro TEXT,
  costes_planificados NUMERIC,
  costes_reales NUMERIC
) AS $$
DECLARE
  v_user_id UUID;
  v_is_admin BOOLEAN;
  v_user_centros TEXT[];
BEGIN
  v_user_id := auth.uid();
  v_is_admin := has_role(v_user_id, 'admin'::app_role);
  
  IF NOT v_is_admin THEN
    SELECT ARRAY_AGG(DISTINCT centro)
    INTO v_user_centros
    FROM user_roles
    WHERE user_id = v_user_id 
      AND role = 'gestor'::app_role
      AND centro IS NOT NULL;
  END IF;

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
      AND (v_is_admin OR e.centro = ANY(v_user_centros))
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
      AND (v_is_admin OR e.centro = ANY(v_user_centros))
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Add trigger for centres updated_at
CREATE TRIGGER update_centres_updated_at
BEFORE UPDATE ON public.centres
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();