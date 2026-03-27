-- Add service_id to absences to prevent data loss when multiple services
-- sync absences for the same employee on the same date.
-- Previously, the unique constraint (employee_id, fecha, tipo) caused
-- the last service sync to overwrite earlier ones.

ALTER TABLE public.absences
  ADD COLUMN IF NOT EXISTS service_id TEXT;

-- Drop old unique constraint and create new one including service_id
-- This allows the same employee to have absences from different services
DO $$
BEGIN
  -- Try to drop the old constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'absences_employee_id_fecha_tipo_key'
  ) THEN
    ALTER TABLE public.absences DROP CONSTRAINT absences_employee_id_fecha_tipo_key;
  END IF;
END $$;

ALTER TABLE public.absences
  ADD CONSTRAINT absences_employee_id_fecha_tipo_service_key
  UNIQUE (employee_id, fecha, tipo, service_id);
