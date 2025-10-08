-- Create severity enum
CREATE TYPE public.dq_severity AS ENUM ('critica', 'alta', 'media', 'baja');

-- Create dq_issues table
CREATE TABLE public.dq_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL,
  severidad dq_severity NOT NULL DEFAULT 'media',
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  periodo_inicio DATE NOT NULL,
  periodo_fin DATE NOT NULL,
  centro TEXT,
  detalle JSONB DEFAULT '{}'::jsonb,
  resuelto BOOLEAN NOT NULL DEFAULT false,
  resuelto_por UUID REFERENCES public.profiles(id),
  resuelto_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.dq_issues ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage all dq issues"
ON public.dq_issues
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Gestores can view dq issues for their centro"
ON public.dq_issues
FOR SELECT
USING (
  has_role(auth.uid(), 'gestor'::app_role) 
  AND centro IN (
    SELECT ur.centro 
    FROM user_roles ur 
    WHERE ur.user_id = auth.uid() AND ur.role = 'gestor'::app_role
  )
);

CREATE POLICY "Gestores can update dq issues for their centro"
ON public.dq_issues
FOR UPDATE
USING (
  has_role(auth.uid(), 'gestor'::app_role) 
  AND centro IN (
    SELECT ur.centro 
    FROM user_roles ur 
    WHERE ur.user_id = auth.uid() AND ur.role = 'gestor'::app_role
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_dq_issues_updated_at
BEFORE UPDATE ON public.dq_issues
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes
CREATE INDEX idx_dq_issues_employee_id ON public.dq_issues(employee_id);
CREATE INDEX idx_dq_issues_centro ON public.dq_issues(centro);
CREATE INDEX idx_dq_issues_periodo ON public.dq_issues(periodo_inicio, periodo_fin);
CREATE INDEX idx_dq_issues_resuelto ON public.dq_issues(resuelto);
CREATE INDEX idx_dq_issues_tipo ON public.dq_issues(tipo);

-- Function to detect DQ issues
CREATE OR REPLACE FUNCTION public.detect_dq_issues(
  p_start_date DATE,
  p_end_date DATE,
  p_centro TEXT DEFAULT NULL
)
RETURNS TABLE(
  issues_detected INTEGER,
  plan_sin_real INTEGER,
  real_sin_plan INTEGER,
  coste_atipico INTEGER,
  empleado_sin_centro INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_sin_real INTEGER := 0;
  v_real_sin_plan INTEGER := 0;
  v_coste_atipico INTEGER := 0;
  v_empleado_sin_centro INTEGER := 0;
  v_q1 NUMERIC;
  v_q3 NUMERIC;
  v_iqr NUMERIC;
  v_lower_bound NUMERIC;
  v_upper_bound NUMERIC;
BEGIN
  -- Delete existing issues for this period to avoid duplicates
  DELETE FROM dq_issues 
  WHERE periodo_inicio = p_start_date 
    AND periodo_fin = p_end_date
    AND (p_centro IS NULL OR centro = p_centro);

  -- RULE 1: PLAN_SIN_REAL - Planned hours > 0 but no payroll hours
  INSERT INTO dq_issues (tipo, severidad, employee_id, periodo_inicio, periodo_fin, centro, detalle)
  SELECT 
    'PLAN_SIN_REAL',
    'alta'::dq_severity,
    e.id,
    p_start_date,
    p_end_date,
    e.centro,
    jsonb_build_object(
      'horas_planificadas', SUM(s.horas_planificadas),
      'horas_trabajadas', COALESCE(SUM(p.horas_trabajadas), 0),
      'empleado', e.nombre || ' ' || e.apellidos
    )
  FROM employees e
  JOIN schedules s ON s.employee_id = e.id
  LEFT JOIN payrolls p ON p.employee_id = e.id 
    AND p.periodo_inicio >= p_start_date 
    AND p.periodo_fin <= p_end_date
  WHERE s.fecha BETWEEN p_start_date AND p_end_date
    AND (p_centro IS NULL OR e.centro = p_centro)
  GROUP BY e.id, e.centro, e.nombre, e.apellidos
  HAVING SUM(s.horas_planificadas) > 0 
    AND COALESCE(SUM(p.horas_trabajadas), 0) = 0;
  
  GET DIAGNOSTICS v_plan_sin_real = ROW_COUNT;

  -- RULE 2: REAL_SIN_PLAN - Worked hours > 0 but no planned hours
  INSERT INTO dq_issues (tipo, severidad, employee_id, periodo_inicio, periodo_fin, centro, detalle)
  SELECT 
    'REAL_SIN_PLAN',
    'media'::dq_severity,
    e.id,
    p_start_date,
    p_end_date,
    e.centro,
    jsonb_build_object(
      'horas_trabajadas', SUM(p.horas_trabajadas),
      'horas_planificadas', COALESCE(SUM(s.horas_planificadas), 0),
      'empleado', e.nombre || ' ' || e.apellidos
    )
  FROM employees e
  JOIN payrolls p ON p.employee_id = e.id
  LEFT JOIN schedules s ON s.employee_id = e.id 
    AND s.fecha BETWEEN p_start_date AND p_end_date
  WHERE p.periodo_inicio >= p_start_date 
    AND p.periodo_fin <= p_end_date
    AND (p_centro IS NULL OR e.centro = p_centro)
  GROUP BY e.id, e.centro, e.nombre, e.apellidos
  HAVING SUM(p.horas_trabajadas) > 0 
    AND COALESCE(SUM(s.horas_planificadas), 0) = 0;
  
  GET DIAGNOSTICS v_real_sin_plan = ROW_COUNT;

  -- RULE 3: COSTE_ATIPICO - Outlier cost per hour using IQR method
  -- Calculate Q1, Q3, and IQR
  SELECT 
    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY coste_total / NULLIF(horas_trabajadas, 0)),
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY coste_total / NULLIF(horas_trabajadas, 0))
  INTO v_q1, v_q3
  FROM payrolls p
  JOIN employees e ON e.id = p.employee_id
  WHERE p.periodo_inicio >= p_start_date 
    AND p.periodo_fin <= p_end_date
    AND (p_centro IS NULL OR e.centro = p_centro)
    AND horas_trabajadas > 0;

  IF v_q1 IS NOT NULL AND v_q3 IS NOT NULL THEN
    v_iqr := v_q3 - v_q1;
    v_lower_bound := v_q1 - 1.5 * v_iqr;
    v_upper_bound := v_q3 + 1.5 * v_iqr;

    INSERT INTO dq_issues (tipo, severidad, employee_id, periodo_inicio, periodo_fin, centro, detalle)
    SELECT 
      'COSTE_ATIPICO',
      CASE 
        WHEN (p.coste_total / NULLIF(p.horas_trabajadas, 0)) < v_q1 - 3 * v_iqr 
          OR (p.coste_total / NULLIF(p.horas_trabajadas, 0)) > v_q3 + 3 * v_iqr 
        THEN 'critica'::dq_severity
        ELSE 'alta'::dq_severity
      END,
      e.id,
      p_start_date,
      p_end_date,
      e.centro,
      jsonb_build_object(
        'coste_hora', ROUND(p.coste_total / NULLIF(p.horas_trabajadas, 0), 2),
        'coste_total', p.coste_total,
        'horas_trabajadas', p.horas_trabajadas,
        'empleado', e.nombre || ' ' || e.apellidos,
        'rango_esperado', jsonb_build_object(
          'min', ROUND(v_lower_bound, 2),
          'max', ROUND(v_upper_bound, 2)
        )
      )
    FROM payrolls p
    JOIN employees e ON e.id = p.employee_id
    WHERE p.periodo_inicio >= p_start_date 
      AND p.periodo_fin <= p_end_date
      AND (p_centro IS NULL OR e.centro = p_centro)
      AND p.horas_trabajadas > 0
      AND (
        (p.coste_total / NULLIF(p.horas_trabajadas, 0)) < v_lower_bound
        OR (p.coste_total / NULLIF(p.horas_trabajadas, 0)) > v_upper_bound
      );
    
    GET DIAGNOSTICS v_coste_atipico = ROW_COUNT;
  END IF;

  -- RULE 4: EMPLEADO_SIN_CENTRO - Active employees without centro
  INSERT INTO dq_issues (tipo, severidad, employee_id, periodo_inicio, periodo_fin, centro, detalle)
  SELECT 
    'EMPLEADO_SIN_CENTRO',
    'media'::dq_severity,
    e.id,
    p_start_date,
    p_end_date,
    NULL,
    jsonb_build_object(
      'empleado', e.nombre || ' ' || e.apellidos,
      'fecha_alta', e.fecha_alta
    )
  FROM employees e
  WHERE (e.centro IS NULL OR e.centro = '')
    AND (e.fecha_baja IS NULL OR e.fecha_baja > p_end_date)
    AND e.fecha_alta <= p_end_date;
  
  GET DIAGNOSTICS v_empleado_sin_centro = ROW_COUNT;

  -- Return summary
  RETURN QUERY SELECT 
    (v_plan_sin_real + v_real_sin_plan + v_coste_atipico + v_empleado_sin_centro)::INTEGER,
    v_plan_sin_real,
    v_real_sin_plan,
    v_coste_atipico,
    v_empleado_sin_centro;
END;
$$;