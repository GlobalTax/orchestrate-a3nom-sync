-- FASE 1: Ampliar tabla centres con información completa de restaurantes
-- Añadir nuevas columnas para datos detallados de McDonald's

ALTER TABLE public.centres 
  ADD COLUMN IF NOT EXISTS postal_code TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS site_number TEXT,
  ADD COLUMN IF NOT EXISTS franchisee_name TEXT,
  ADD COLUMN IF NOT EXISTS franchisee_email TEXT,
  ADD COLUMN IF NOT EXISTS company_tax_id TEXT,
  ADD COLUMN IF NOT EXISTS seating_capacity INTEGER,
  ADD COLUMN IF NOT EXISTS square_meters NUMERIC,
  ADD COLUMN IF NOT EXISTS opening_date DATE;

-- Crear constraint unique para site_number (después de añadir columna)
ALTER TABLE public.centres 
  ADD CONSTRAINT centres_site_number_unique UNIQUE (site_number);

-- Índices para mejorar rendimiento de búsquedas
CREATE INDEX IF NOT EXISTS idx_centres_site_number ON public.centres(site_number);
CREATE INDEX IF NOT EXISTS idx_centres_franchisee_email ON public.centres(franchisee_email);
CREATE INDEX IF NOT EXISTS idx_centres_ciudad ON public.centres(ciudad);
CREATE INDEX IF NOT EXISTS idx_centres_postal_code ON public.centres(postal_code);

-- Comentarios para documentación
COMMENT ON COLUMN public.centres.site_number IS 'Número de sitio único del restaurante (ej: 12345)';
COMMENT ON COLUMN public.centres.franchisee_email IS 'Email del franquiciado responsable del restaurante';
COMMENT ON COLUMN public.centres.franchisee_name IS 'Nombre completo del franquiciado';
COMMENT ON COLUMN public.centres.company_tax_id IS 'NIF/CIF de la empresa franquiciada';
COMMENT ON COLUMN public.centres.seating_capacity IS 'Capacidad de asientos del restaurante';
COMMENT ON COLUMN public.centres.square_meters IS 'Superficie en metros cuadrados';
COMMENT ON COLUMN public.centres.opening_date IS 'Fecha de apertura del restaurante';