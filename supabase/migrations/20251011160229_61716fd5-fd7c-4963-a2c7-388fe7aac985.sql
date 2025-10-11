-- Fix RLS causing permission denied for table auth.users when selecting franchisees
-- We replace the policy that referenced auth.users with one that uses public.profiles

begin;

-- Drop problematic policy if it exists
DROP POLICY IF EXISTS "Gestores can view their own franchisee data" ON public.franchisees;

-- Create a safe SELECT policy leveraging profiles (no access to auth.users)
CREATE POLICY "Users can view their own franchisee data (via profiles)"
ON public.franchisees
FOR SELECT
TO authenticated
USING (
  email IN (
    SELECT p.email
    FROM public.profiles p
    WHERE p.id = auth.uid()
  )
);

commit;