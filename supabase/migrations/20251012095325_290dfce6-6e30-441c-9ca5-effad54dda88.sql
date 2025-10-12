-- FASE 1: Unificar modelo de datos - Fixed duplicate handling

-- Step 1: Add franchisee_id to centres if not exists
ALTER TABLE centres ADD COLUMN IF NOT EXISTS franchisee_id UUID REFERENCES franchisees(id);

-- Step 2: Update existing centres with data from Restaurants where IDs match
UPDATE centres c
SET 
  franchisee_id = COALESCE(c.franchisee_id, r.franchisee_id),
  franchisee_name = COALESCE(c.franchisee_name, r.franchisee_name),
  franchisee_email = COALESCE(c.franchisee_email, r.franchisee_email),
  company_tax_id = COALESCE(c.company_tax_id, r.company_tax_id),
  site_number = COALESCE(c.site_number, r.site_number),
  postal_code = COALESCE(c.postal_code, r.postal_code),
  state = COALESCE(c.state, r.state),
  nombre = COALESCE(c.nombre, r.name),
  direccion = COALESCE(c.direccion, r.address),
  ciudad = COALESCE(c.ciudad, r.city),
  pais = COALESCE(c.pais, r.country),
  seating_capacity = CASE 
    WHEN c.seating_capacity IS NOT NULL THEN c.seating_capacity
    WHEN r.seating_capacity IS NULL OR r.seating_capacity = '' THEN NULL
    ELSE r.seating_capacity::integer
  END,
  square_meters = CASE 
    WHEN c.square_meters IS NOT NULL THEN c.square_meters
    WHEN r.square_meters IS NULL OR r.square_meters = '' THEN NULL
    ELSE r.square_meters::numeric
  END,
  opening_date = CASE 
    WHEN c.opening_date IS NOT NULL THEN c.opening_date
    WHEN r.opening_date IS NULL OR r.opening_date = '' THEN NULL
    ELSE r.opening_date::date
  END,
  updated_at = now()
FROM "Restaurants" r
WHERE c.id = r.id::uuid;

-- Step 3: Drop the Restaurants table as it's now redundant
DROP TABLE IF EXISTS "Restaurants" CASCADE;

-- Step 4: Update the get_restaurants_with_franchisees function to use centres
CREATE OR REPLACE FUNCTION public.get_restaurants_with_franchisees()
RETURNS TABLE(
  id text,
  name text,
  site_number text,
  address text,
  city text,
  state text,
  country text,
  postal_code text,
  seating_capacity text,
  square_meters text,
  opening_date text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  franchisee_id uuid,
  franchisee_name text,
  franchisee_email text,
  company_tax_id text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $function$
  SELECT 
    c.id::text,
    c.nombre as name,
    c.site_number,
    c.direccion as address,
    c.ciudad as city,
    c.state,
    c.pais as country,
    c.postal_code,
    c.seating_capacity::text,
    c.square_meters::text,
    c.opening_date::text,
    c.created_at,
    c.updated_at,
    c.franchisee_id,
    COALESCE(f.name, c.franchisee_name) as franchisee_name,
    COALESCE(f.email, c.franchisee_email) as franchisee_email,
    COALESCE(f.company_tax_id, c.company_tax_id) as company_tax_id
  FROM centres c
  LEFT JOIN franchisees f ON f.id = c.franchisee_id
  WHERE c.activo = true
  ORDER BY c.nombre;
$function$;

-- Step 5: Create index on franchisee_id for better performance
CREATE INDEX IF NOT EXISTS idx_centres_franchisee_id ON centres(franchisee_id);

-- Step 6: Add comment to document the consolidation
COMMENT ON TABLE centres IS 'Consolidated restaurant/centre table. Previously split between Restaurants and centres tables.';