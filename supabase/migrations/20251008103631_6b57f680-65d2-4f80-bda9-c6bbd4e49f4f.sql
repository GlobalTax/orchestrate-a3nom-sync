-- Add Orquest mapping columns to centres table
ALTER TABLE public.centres 
ADD COLUMN IF NOT EXISTS orquest_service_id TEXT,
ADD COLUMN IF NOT EXISTS orquest_business_id TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_centres_orquest_service_id 
ON public.centres(orquest_service_id);

-- Add comment explaining the mapping
COMMENT ON COLUMN public.centres.orquest_service_id IS 'Orquest Service ID - maps this centre to an Orquest service/restaurant';
COMMENT ON COLUMN public.centres.orquest_business_id IS 'Orquest Business ID - the parent business in Orquest';
COMMENT ON COLUMN public.centres.codigo IS 'Internal centre code - also used as a3Nom CODCENTRO for payroll mapping';
COMMENT ON COLUMN public.centres.nombre IS 'Centre name - also used as a3Nom NOMCENTRO for payroll mapping';