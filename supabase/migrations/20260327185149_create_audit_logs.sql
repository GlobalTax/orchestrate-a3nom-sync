-- Create audit_logs table for full accounting traceability
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data jsonb,
  new_data jsonb,
  changed_fields text[],
  user_id uuid REFERENCES auth.users(id),
  ip_address inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX idx_audit_logs_table_name ON public.audit_logs(table_name);
CREATE INDEX idx_audit_logs_record_id ON public.audit_logs(record_id);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can read audit logs
CREATE POLICY "Admins can view audit logs"
  ON public.audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
  );

-- Nobody can modify audit logs via the API (insert only via trigger)
CREATE POLICY "System insert only"
  ON public.audit_logs FOR INSERT
  WITH CHECK (false);

-- Generic audit trigger function
CREATE OR REPLACE FUNCTION public.audit_trigger_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed text[];
  col text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (table_name, record_id, action, new_data, user_id)
    VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', to_jsonb(NEW), auth.uid());
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Compute changed fields
    changed := ARRAY[]::text[];
    FOR col IN SELECT column_name FROM information_schema.columns
      WHERE table_schema = TG_TABLE_SCHEMA AND table_name = TG_TABLE_NAME
    LOOP
      IF to_jsonb(NEW) -> col IS DISTINCT FROM to_jsonb(OLD) -> col THEN
        changed := array_append(changed, col);
      END IF;
    END LOOP;

    INSERT INTO public.audit_logs (table_name, record_id, action, old_data, new_data, changed_fields, user_id)
    VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), changed, auth.uid());
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (table_name, record_id, action, old_data, user_id)
    VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', to_jsonb(OLD), auth.uid());
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

-- Attach audit triggers to key tables
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'centres',
    'franchisees',
    'employees',
    'user_roles',
    'schedules',
    'payrolls',
    'absences'
  ])
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
      EXECUTE format(
        'CREATE TRIGGER audit_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn()',
        tbl, tbl
      );
    END IF;
  END LOOP;
END;
$$;
