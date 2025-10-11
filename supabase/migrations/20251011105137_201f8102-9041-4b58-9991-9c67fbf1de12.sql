-- Paso 1: Crear tabla de franquiciados
CREATE TABLE public.franchisees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  company_tax_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Trigger para updated_at
CREATE TRIGGER update_franchisees_updated_at
  BEFORE UPDATE ON public.franchisees
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar RLS
ALTER TABLE public.franchisees ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admins can manage all franchisees"
ON public.franchisees FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Gestores can view their own franchisee data"
ON public.franchisees FOR SELECT
TO authenticated
USING (
  email IN (
    SELECT u.email FROM auth.users u WHERE u.id = auth.uid()
  )
);

-- Paso 2: Añadir foreign key a Restaurants
ALTER TABLE public."Restaurants" 
ADD COLUMN franchisee_id uuid REFERENCES public.franchisees(id) ON DELETE SET NULL;

-- Paso 3: Migrar datos existentes de franquiciados (eliminando duplicados)
WITH unique_franchisees AS (
  SELECT DISTINCT ON (franchisee_email)
    franchisee_email,
    franchisee_name,
    company_tax_id
  FROM public."Restaurants"
  WHERE franchisee_email IS NOT NULL 
    AND franchisee_email != ''
    AND franchisee_name IS NOT NULL
  ORDER BY franchisee_email, updated_at DESC NULLS LAST
)
INSERT INTO public.franchisees (email, name, company_tax_id)
SELECT 
  franchisee_email,
  franchisee_name,
  company_tax_id
FROM unique_franchisees
ON CONFLICT (email) DO NOTHING;

-- Paso 4: Actualizar foreign keys en Restaurants
UPDATE public."Restaurants" r
SET franchisee_id = f.id
FROM public.franchisees f
WHERE r.franchisee_email = f.email;

-- Paso 5: Crear vista de compatibilidad
CREATE OR REPLACE VIEW public.v_restaurants_with_franchisees AS
SELECT 
  r.id,
  r.name,
  r.site_number,
  r.address,
  r.city,
  r.state,
  r.country,
  r.postal_code,
  r.seating_capacity,
  r.square_meters,
  r.opening_date,
  r.created_at,
  r.updated_at,
  r.franchisee_id,
  f.name as franchisee_name,
  f.email as franchisee_email,
  f.company_tax_id
FROM public."Restaurants" r
LEFT JOIN public.franchisees f ON f.id = r.franchisee_id;