-- Phase 1: Create restaurant_services table for N:M mapping between restaurants and Orquest services
CREATE TABLE IF NOT EXISTS public.restaurant_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  centro_id UUID NOT NULL REFERENCES public.centres(id) ON DELETE CASCADE,
  orquest_service_id TEXT NOT NULL,
  descripcion TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(orquest_service_id)
);

-- Indexes for performance
CREATE INDEX idx_restaurant_services_centro_id ON public.restaurant_services(centro_id);
CREATE INDEX idx_restaurant_services_service_id ON public.restaurant_services(orquest_service_id);

-- Enable RLS
ALTER TABLE public.restaurant_services ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage all restaurant_services"
ON public.restaurant_services
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Users can view restaurant_services for their accessible centres"
ON public.restaurant_services
FOR SELECT
TO authenticated
USING (
  centro_id IN (
    SELECT c.id 
    FROM centres c 
    WHERE c.codigo IN (
      SELECT centro_code 
      FROM v_user_centres 
      WHERE user_id = auth.uid()
    )
  )
);

-- Audit triggers
CREATE TRIGGER audit_restaurant_services_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.restaurant_services
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- Updated_at trigger
CREATE TRIGGER update_restaurant_services_updated_at
  BEFORE UPDATE ON public.restaurant_services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE public.restaurant_services IS 'N:M mapping between restaurants (centres) and Orquest Services. Allows one restaurant to aggregate multiple Orquest services (e.g., kitchen, dining room, bar)';
COMMENT ON COLUMN public.restaurant_services.orquest_service_id IS 'Orquest Service ID - unique constraint ensures each service belongs to only one restaurant';

-- Phase 2: Migrate existing orquest_service_id from centres to restaurant_services
INSERT INTO public.restaurant_services (centro_id, orquest_service_id, descripcion, activo)
SELECT 
  id,
  orquest_service_id,
  'Migrado desde configuración anterior',
  activo
FROM public.centres
WHERE orquest_service_id IS NOT NULL
ON CONFLICT (orquest_service_id) DO NOTHING;

-- Phase 7: Create function for metrics by service
CREATE OR REPLACE FUNCTION public.get_metrics_by_service(
  p_start_date DATE,
  p_end_date DATE,
  p_centro_code TEXT DEFAULT NULL
)
RETURNS TABLE(
  service_id TEXT,
  service_descripcion TEXT,
  horas_planificadas NUMERIC,
  horas_trabajadas NUMERIC,
  empleados_activos INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
$$;