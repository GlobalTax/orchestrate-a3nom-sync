-- ============================================
-- Phase 1: Extend app_role enum
-- ============================================
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'franquiciado' AND enumtypid = 'public.app_role'::regtype) THEN
    ALTER TYPE public.app_role ADD VALUE 'franquiciado';
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'asesoria' AND enumtypid = 'public.app_role'::regtype) THEN
    ALTER TYPE public.app_role ADD VALUE 'asesoria';
  END IF;
END $$;

-- ============================================
-- Phase 2: Add franchisee_id to user_roles
-- ============================================
ALTER TABLE public.user_roles 
ADD COLUMN IF NOT EXISTS franchisee_id uuid REFERENCES public.franchisees(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_user_roles_user_franchisee 
ON public.user_roles (user_id, franchisee_id);

-- ============================================
-- Phase 3: Create invites table
-- ============================================
CREATE TABLE IF NOT EXISTS public.invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  role public.app_role NOT NULL,
  centro text NULL,
  franchisee_id uuid NULL REFERENCES public.franchisees(id) ON DELETE SET NULL,
  token text NOT NULL UNIQUE,
  invited_by uuid NULL,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for invites
CREATE INDEX IF NOT EXISTS idx_invites_token ON public.invites(token);
CREATE INDEX IF NOT EXISTS idx_invites_email ON public.invites(email);
CREATE INDEX IF NOT EXISTS idx_invites_valid ON public.invites(accepted_at, expires_at);

-- ============================================
-- Phase 4: Enable RLS on invites
-- ============================================
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

-- Admin can manage all invites
CREATE POLICY "Admins manage invites"
ON public.invites
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Anonymous users can read valid invites by token
CREATE POLICY "Anon can read valid invites"
ON public.invites
FOR SELECT
TO anon
USING (accepted_at IS NULL AND expires_at > now());

-- Authenticated users can mark their own invite as accepted
CREATE POLICY "User can mark own invite accepted"
ON public.invites
FOR UPDATE
TO authenticated
USING ((auth.jwt() ->> 'email') = email AND accepted_at IS NULL)
WITH CHECK ((auth.jwt() ->> 'email') = email);