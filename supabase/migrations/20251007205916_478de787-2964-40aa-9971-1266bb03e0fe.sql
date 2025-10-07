-- Tabla para guardar perfiles de mapeo de importación
CREATE TABLE IF NOT EXISTS public.import_mapping_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_name text NOT NULL,
  column_mappings jsonb NOT NULL,
  file_type text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.import_mapping_profiles ENABLE ROW LEVEL SECURITY;

-- Users can view their own profiles
CREATE POLICY "Users can view their own import profiles"
ON public.import_mapping_profiles
FOR SELECT
USING (user_id = auth.uid());

-- Users can create their own profiles
CREATE POLICY "Users can create their own import profiles"
ON public.import_mapping_profiles
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Users can update their own profiles
CREATE POLICY "Users can update their own import profiles"
ON public.import_mapping_profiles
FOR UPDATE
USING (user_id = auth.uid());

-- Users can delete their own profiles
CREATE POLICY "Users can delete their own import profiles"
ON public.import_mapping_profiles
FOR DELETE
USING (user_id = auth.uid());

-- Trigger for updated_at
CREATE TRIGGER update_import_mapping_profiles_updated_at
BEFORE UPDATE ON public.import_mapping_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Tabla para log de importaciones
CREATE TABLE IF NOT EXISTS public.import_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_type text NOT NULL,
  total_rows integer NOT NULL DEFAULT 0,
  loaded_rows integer NOT NULL DEFAULT 0,
  skipped_rows integer NOT NULL DEFAULT 0,
  error_rows integer NOT NULL DEFAULT 0,
  error_details jsonb,
  status text NOT NULL DEFAULT 'processing',
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.import_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view all logs
CREATE POLICY "Admins can view all import logs"
ON public.import_logs
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Users can create logs
CREATE POLICY "Users can create import logs"
ON public.import_logs
FOR INSERT
WITH CHECK (user_id = auth.uid());