-- Tabla para logs de health checks del sistema
CREATE TABLE IF NOT EXISTS public.system_health_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  overall_status TEXT NOT NULL CHECK (overall_status IN ('healthy', 'degraded', 'down')),
  supabase_status TEXT NOT NULL CHECK (supabase_status IN ('ok', 'slow', 'error')),
  supabase_latency_ms INTEGER,
  orquest_status TEXT NOT NULL CHECK (orquest_status IN ('ok', 'slow', 'error', 'unreachable')),
  orquest_latency_ms INTEGER,
  orquest_error TEXT,
  last_sync_status TEXT,
  last_sync_at TIMESTAMPTZ,
  employees_count INTEGER DEFAULT 0,
  schedules_count INTEGER DEFAULT 0,
  absences_count INTEGER DEFAULT 0,
  payrolls_count INTEGER DEFAULT 0,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para consultas eficientes
CREATE INDEX IF NOT EXISTS idx_system_health_logs_checked_at ON public.system_health_logs(checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_health_logs_overall_status ON public.system_health_logs(overall_status);

-- RLS
ALTER TABLE public.system_health_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all health logs"
ON public.system_health_logs FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert health logs"
ON public.system_health_logs FOR INSERT
WITH CHECK (true);

-- Tabla opcional para logs detallados de latencia de Orquest
CREATE TABLE IF NOT EXISTS public.orquest_latency_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'GET',
  latency_ms INTEGER NOT NULL,
  status_code INTEGER NOT NULL,
  success BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orquest_latency_logs_created_at ON public.orquest_latency_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orquest_latency_logs_endpoint ON public.orquest_latency_logs(endpoint);

ALTER TABLE public.orquest_latency_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view latency logs"
ON public.orquest_latency_logs FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert latency logs"
ON public.orquest_latency_logs FOR INSERT
WITH CHECK (true);

-- Configurar cron job para health checks cada hora
SELECT cron.schedule(
  'health-check-hourly',
  '0 * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://srwnjnrhxzcpftmbbyib.supabase.co/functions/v1/check_system_health',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNyd25qbnJoeHpjcGZ0bWJieWliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzMzY1NjMsImV4cCI6MjA2ODkxMjU2M30.JCQDhjjtXKrPCDV8QRYJmmJ6n9YxMtBPfUm8E52UbI4'
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);