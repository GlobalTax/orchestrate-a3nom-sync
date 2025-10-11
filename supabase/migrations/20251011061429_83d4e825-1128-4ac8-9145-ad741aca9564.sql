-- Fix RLS: ensure admins can INSERT/UPDATE via WITH CHECK
DROP POLICY IF EXISTS "Admins can manage all user roles" ON public.user_roles;

CREATE POLICY "Admins can manage all user roles"
ON public.user_roles
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- keep existing self-view policy as is (not dropped here)
-- Optionally, ensure RLS is enabled (no-op if already enabled)
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;