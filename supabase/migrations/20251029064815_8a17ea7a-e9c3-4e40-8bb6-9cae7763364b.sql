-- Crear tabla servicios_orquest
CREATE TABLE IF NOT EXISTS public.servicios_orquest (
  id text PRIMARY KEY,
  updated_at timestamptz DEFAULT now(),
  nombre text NOT NULL,
  zona_horaria text,
  latitud numeric,
  longitud numeric,
  datos_completos jsonb,
  franchisee_id uuid REFERENCES public.franchisees(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Índices optimizados
CREATE INDEX IF NOT EXISTS idx_servicios_orquest_updated_at ON public.servicios_orquest(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_servicios_orquest_franchisee ON public.servicios_orquest(franchisee_id);
CREATE INDEX IF NOT EXISTS idx_servicios_orquest_nombre ON public.servicios_orquest(nombre);

-- Habilitar RLS
ALTER TABLE public.servicios_orquest ENABLE ROW LEVEL SECURITY;

-- Política de solo lectura para usuarios autenticados
CREATE POLICY "Usuarios autenticados pueden ver servicios_orquest"
ON public.servicios_orquest
FOR SELECT
USING (auth.role() = 'authenticated');

-- Política para admins
CREATE POLICY "Admins pueden gestionar servicios_orquest"
ON public.servicios_orquest
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_servicios_orquest()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_servicios_orquest_updated_at
BEFORE UPDATE ON public.servicios_orquest
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_servicios_orquest();

-- Crear tabla para logs de sincronización de servicios
CREATE TABLE IF NOT EXISTS public.orquest_services_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  status text CHECK (status IN ('running', 'completed', 'failed', 'partial')) DEFAULT 'running',
  total_franchisees integer DEFAULT 0,
  franchisees_succeeded integer DEFAULT 0,
  franchisees_failed integer DEFAULT 0,
  total_services integer DEFAULT 0,
  errors jsonb DEFAULT '[]'::jsonb,
  results jsonb DEFAULT '[]'::jsonb,
  trigger_source text DEFAULT 'manual' CHECK (trigger_source IN ('manual', 'cron')),
  triggered_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Índice para logs
CREATE INDEX IF NOT EXISTS idx_orquest_services_sync_logs_started_at 
ON public.orquest_services_sync_logs(started_at DESC);

-- RLS para logs de servicios
ALTER TABLE public.orquest_services_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins pueden ver logs de servicios"
ON public.orquest_services_sync_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

CREATE POLICY "Sistema puede insertar logs de servicios"
ON public.orquest_services_sync_logs
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Sistema puede actualizar logs de servicios"
ON public.orquest_services_sync_logs
FOR UPDATE
USING (true);