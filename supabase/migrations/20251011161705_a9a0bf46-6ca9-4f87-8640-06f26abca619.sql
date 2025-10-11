-- Create SECURITY DEFINER function to fetch restaurants with franchisees
-- This bypasses RLS issues with views by executing with owner privileges

CREATE OR REPLACE FUNCTION public.get_restaurants_with_franchisees()
RETURNS TABLE (
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
  created_at timestamptz,
  updated_at timestamptz,
  franchisee_id uuid,
  franchisee_name text,
  franchisee_email text,
  company_tax_id text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
    f.name AS franchisee_name,
    f.email AS franchisee_email,
    f.company_tax_id
  FROM "Restaurants" r
  LEFT JOIN franchisees f ON f.id = r.franchisee_id
  ORDER BY r.name;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_restaurants_with_franchisees() TO authenticated;