-- Create organization_settings table
CREATE TABLE public.organization_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Orquest configuration
  orquest_base_url TEXT,
  orquest_default_service_id TEXT,
  orquest_periodo_politica TEXT DEFAULT 'mes_natural' CHECK (orquest_periodo_politica IN ('mes_natural', 'mes_comercial')),
  
  -- Payroll configuration
  nominas_formato_esperado TEXT DEFAULT 'a3nom' CHECK (nominas_formato_esperado IN ('a3nom', 'personalizado')),
  nominas_columnas_requeridas JSONB DEFAULT '["codtrabajador", "periodo_inicio", "periodo_fin", "horas_trabajadas"]'::jsonb,
  
  -- Email configuration
  email_remitente_nombre TEXT DEFAULT 'Orquest + A3Nom',
  email_remitente_email TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Only one row of global configuration should exist
CREATE UNIQUE INDEX idx_organization_settings_single_row 
ON public.organization_settings ((true));

-- Index for faster queries
CREATE INDEX idx_organization_settings_updated_at ON public.organization_settings(updated_at);

-- Enable RLS
ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can view organization settings"
ON public.organization_settings FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage organization settings"
ON public.organization_settings FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert initial row
INSERT INTO public.organization_settings (id) 
VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

-- Add theme column to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system'));

-- Index for theme queries
CREATE INDEX IF NOT EXISTS idx_profiles_theme ON public.profiles(theme);

-- Trigger for updated_at on organization_settings
CREATE TRIGGER update_organization_settings_updated_at
BEFORE UPDATE ON public.organization_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();