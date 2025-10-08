-- Create sync_logs table to track all synchronization executions
CREATE TABLE IF NOT EXISTS public.sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type TEXT NOT NULL CHECK (sync_type IN ('employees', 'schedules', 'absences', 'full')),
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'partial')),
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Parameters used for this sync
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Counters
  total_rows INTEGER DEFAULT 0,
  processed_rows INTEGER DEFAULT 0,
  inserted_rows INTEGER DEFAULT 0,
  updated_rows INTEGER DEFAULT 0,
  error_rows INTEGER DEFAULT 0,
  
  -- Error details
  errors JSONB DEFAULT '[]'::jsonb,
  
  -- Metadata
  triggered_by UUID REFERENCES auth.users(id),
  trigger_source TEXT DEFAULT 'manual' CHECK (trigger_source IN ('manual', 'cron', 'api')),
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on sync_logs
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view all sync logs
CREATE POLICY "Admins can view all sync logs"
ON public.sync_logs
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- System can insert sync logs
CREATE POLICY "System can insert sync logs"
ON public.sync_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- System can update sync logs
CREATE POLICY "System can update sync logs"
ON public.sync_logs
FOR UPDATE
TO authenticated
USING (true);

-- Add indexes for better query performance
CREATE INDEX idx_sync_logs_status ON public.sync_logs(status);
CREATE INDEX idx_sync_logs_type ON public.sync_logs(sync_type);
CREATE INDEX idx_sync_logs_started ON public.sync_logs(started_at DESC);

-- Add unique constraints to schedules and absences for upserts
-- For schedules: unique by employee_id, fecha, service_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_schedules_unique_assignment 
ON public.schedules(employee_id, fecha, COALESCE(service_id, ''));

-- For absences: unique by employee_id, fecha, tipo
CREATE UNIQUE INDEX IF NOT EXISTS idx_absences_unique_entry
ON public.absences(employee_id, fecha, tipo);

-- Add comment to explain the sync_logs table
COMMENT ON TABLE public.sync_logs IS 'Tracks all Orquest synchronization executions with detailed metrics and error handling';

-- Enable pg_cron and pg_net extensions for scheduled syncs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a cron job to run daily sync at 02:00 UTC (sync last 7 days)
SELECT cron.schedule(
  'orquest-daily-sync',
  '0 2 * * *', -- Every day at 02:00 UTC
  $$
  SELECT
    net.http_post(
        url:='https://srwnjnrhxzcpftmbbyib.supabase.co/functions/v1/sync_orquest',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNyd25qbnJoeHpjcGZ0bWJieWliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzMzY1NjMsImV4cCI6MjA2ODkxMjU2M30.JCQDhjjtXKrPCDV8QRYJmmJ6n9YxMtBPfUm8E52UbI4"}'::jsonb,
        body:='{"sync_type": "full", "days_back": 7}'::jsonb
    ) as request_id;
  $$
);