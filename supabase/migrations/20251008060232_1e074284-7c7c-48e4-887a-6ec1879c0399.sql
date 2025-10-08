-- Create audit action enum
CREATE TYPE public.audit_action AS ENUM ('INSERT', 'UPDATE', 'DELETE');

-- Create audit_logs table
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  action audit_action NOT NULL,
  table_name TEXT NOT NULL,
  row_id UUID,
  old_data JSONB,
  new_data JSONB,
  diff JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_table_name ON public.audit_logs(table_name);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX idx_audit_logs_row_id ON public.audit_logs(row_id);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can view all audit logs"
ON public.audit_logs
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "No manual modifications allowed"
ON public.audit_logs
FOR ALL
USING (false);

-- Generic audit trigger function
CREATE OR REPLACE FUNCTION public.audit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_data JSONB;
  v_new_data JSONB;
  v_diff JSONB := '{}'::jsonb;
  v_key TEXT;
  v_user_email TEXT;
BEGIN
  -- Get current user email
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = auth.uid();

  -- Prepare data based on operation
  IF (TG_OP = 'DELETE') THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := NULL;
  ELSIF (TG_OP = 'UPDATE') THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);
    
    -- Calculate differences for changed fields only
    FOR v_key IN SELECT jsonb_object_keys(v_new_data)
    LOOP
      IF v_old_data->v_key IS DISTINCT FROM v_new_data->v_key THEN
        v_diff := v_diff || jsonb_build_object(
          v_key, 
          jsonb_build_object(
            'old', v_old_data->v_key,
            'new', v_new_data->v_key
          )
        );
      END IF;
    END LOOP;
  ELSIF (TG_OP = 'INSERT') THEN
    v_old_data := NULL;
    v_new_data := to_jsonb(NEW);
  END IF;

  -- Insert audit log
  INSERT INTO public.audit_logs (
    user_id,
    user_email,
    action,
    table_name,
    row_id,
    old_data,
    new_data,
    diff,
    created_at
  ) VALUES (
    auth.uid(),
    v_user_email,
    TG_OP::audit_action,
    TG_TABLE_NAME,
    CASE 
      WHEN TG_OP = 'DELETE' THEN (OLD.id)::uuid
      ELSE (NEW.id)::uuid
    END,
    v_old_data,
    v_new_data,
    v_diff,
    now()
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Apply triggers to critical tables
CREATE TRIGGER audit_employees_changes
AFTER INSERT OR UPDATE OR DELETE ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

CREATE TRIGGER audit_schedules_changes
AFTER INSERT OR UPDATE OR DELETE ON public.schedules
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

CREATE TRIGGER audit_absences_changes
AFTER INSERT OR UPDATE OR DELETE ON public.absences
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

CREATE TRIGGER audit_payrolls_changes
AFTER INSERT OR UPDATE OR DELETE ON public.payrolls
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

CREATE TRIGGER audit_user_roles_changes
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

CREATE TRIGGER audit_dq_issues_changes
AFTER INSERT OR UPDATE OR DELETE ON public.dq_issues
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();