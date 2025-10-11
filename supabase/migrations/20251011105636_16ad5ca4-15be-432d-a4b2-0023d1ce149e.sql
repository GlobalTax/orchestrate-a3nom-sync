-- Arreglar problemas de seguridad detectados

-- 1. Añadir RLS policies a la tabla Restaurants
ALTER TABLE public."Restaurants" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all restaurants"
ON public."Restaurants" FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view restaurants"
ON public."Restaurants" FOR SELECT
TO authenticated
USING (true);

-- 2. Arreglar la vista para usar security_invoker en lugar de security_definer
-- Esto hace que la vista use los permisos del usuario que la consulta
DROP VIEW IF EXISTS public.v_restaurants_with_franchisees;

CREATE VIEW public.v_restaurants_with_franchisees 
WITH (security_invoker = true)
AS
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