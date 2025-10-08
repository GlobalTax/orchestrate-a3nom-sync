-- Crear tabla para cachear servicios de Orquest
CREATE TABLE public.orquest_services (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  zona_horaria TEXT,
  latitud NUMERIC,
  longitud NUMERIC,
  datos_completos JSONB,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.orquest_services ENABLE ROW LEVEL SECURITY;

-- Los admins pueden ver y gestionar todos los servicios
CREATE POLICY "Admins can manage all orquest services"
ON public.orquest_services
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Los gestores pueden ver los servicios
CREATE POLICY "Gestores can view orquest services"
ON public.orquest_services
FOR SELECT
USING (has_role(auth.uid(), 'gestor'::app_role));

-- Índice para mejorar las búsquedas por fecha de actualización
CREATE INDEX idx_orquest_services_updated_at ON public.orquest_services(updated_at);