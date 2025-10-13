-- Fase 1: Añadir soporte para API Keys de Orquest por franquiciado

-- 1.1. Añadir columna para API Key en franchisees
ALTER TABLE franchisees 
ADD COLUMN IF NOT EXISTS orquest_api_key TEXT NULL;

COMMENT ON COLUMN franchisees.orquest_api_key IS 'API Key de Orquest (Bearer Token) específica del franquiciado';

-- Índice para búsquedas rápidas de franquiciados con API Key
CREATE INDEX IF NOT EXISTS idx_franchisees_api_key_not_null 
ON franchisees(id) 
WHERE orquest_api_key IS NOT NULL;

-- 1.2. Añadir columna para Business ID (aunque todos usen MCDONALDS_ES, por si acaso)
ALTER TABLE franchisees 
ADD COLUMN IF NOT EXISTS orquest_business_id TEXT DEFAULT 'MCDONALDS_ES';

COMMENT ON COLUMN franchisees.orquest_business_id IS 'Business ID de Orquest (ej: MCDONALDS_ES)';

-- 1.3. Añadir referencia a franquiciado en orquest_services
ALTER TABLE orquest_services
ADD COLUMN IF NOT EXISTS franchisee_id UUID REFERENCES franchisees(id) ON DELETE SET NULL;

COMMENT ON COLUMN orquest_services.franchisee_id IS 'Franquiciado al que pertenece este servicio de Orquest';

CREATE INDEX IF NOT EXISTS idx_orquest_services_franchisee 
ON orquest_services(franchisee_id);

-- Las RLS policies existentes ya protegen franchisees.orquest_api_key:
-- - "Admins can manage all franchisees" permite a admins ver/modificar
-- - Los franquiciados solo ven su propia data pero no incluye orquest_api_key en su SELECT policy