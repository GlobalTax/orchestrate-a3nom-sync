-- Create alerts table for alert rules
CREATE TABLE public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  centro TEXT,
  umbral_valor NUMERIC,
  umbral_operador TEXT NOT NULL DEFAULT 'mayor_que',
  periodo_calculo TEXT NOT NULL DEFAULT 'ultimo_mes',
  canal JSONB NOT NULL DEFAULT '["inapp"]'::jsonb,
  activo BOOLEAN NOT NULL DEFAULT true,
  destinatarios JSONB,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create alert_notifications table for triggered alerts
CREATE TABLE public.alert_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID REFERENCES public.alerts(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  severidad TEXT NOT NULL DEFAULT 'media',
  titulo TEXT NOT NULL,
  mensaje TEXT NOT NULL,
  detalles JSONB,
  centro TEXT,
  leida BOOLEAN NOT NULL DEFAULT false,
  leida_por UUID REFERENCES auth.users(id),
  leida_at TIMESTAMPTZ,
  enviada_email BOOLEAN NOT NULL DEFAULT false,
  email_enviado_at TIMESTAMPTZ,
  destinatario_user_id UUID REFERENCES auth.users(id),
  destinatario_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for alerts
CREATE INDEX idx_alerts_activo ON public.alerts(activo);
CREATE INDEX idx_alerts_centro ON public.alerts(centro);
CREATE INDEX idx_alerts_tipo ON public.alerts(tipo);

-- Indexes for alert_notifications
CREATE INDEX idx_alert_notifications_user ON public.alert_notifications(destinatario_user_id);
CREATE INDEX idx_alert_notifications_leida ON public.alert_notifications(destinatario_user_id, leida);
CREATE INDEX idx_alert_notifications_created ON public.alert_notifications(created_at DESC);
CREATE INDEX idx_alert_notifications_alert_id ON public.alert_notifications(alert_id);

-- Enable RLS
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_notifications ENABLE ROW LEVEL SECURITY;

-- Policies for alerts
CREATE POLICY "Admins can manage all alerts"
ON public.alerts FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Gestores can view alerts for their centro"
ON public.alerts FOR SELECT
USING (
  has_role(auth.uid(), 'gestor'::app_role) 
  AND (centro IS NULL OR centro IN (
    SELECT ur.centro FROM user_roles ur 
    WHERE ur.user_id = auth.uid() AND ur.role = 'gestor'::app_role
  ))
);

-- Policies for alert_notifications
CREATE POLICY "Users can view their own notifications"
ON public.alert_notifications FOR SELECT
USING (destinatario_user_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
ON public.alert_notifications FOR UPDATE
USING (destinatario_user_id = auth.uid());

CREATE POLICY "Admins can view all notifications"
ON public.alert_notifications FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert notifications"
ON public.alert_notifications FOR INSERT
WITH CHECK (true);

-- Trigger for updated_at in alerts
CREATE TRIGGER update_alerts_updated_at
BEFORE UPDATE ON public.alerts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to auto-create notification for critical DQ issues
CREATE OR REPLACE FUNCTION public.notify_critical_dq_issue()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_ids UUID[];
BEGIN
  IF NEW.severidad = 'critica' AND NOT NEW.resuelto THEN
    -- Get all admins and gestores for this centro
    SELECT ARRAY_AGG(DISTINCT user_id)
    INTO v_user_ids
    FROM user_roles
    WHERE role IN ('admin'::app_role, 'gestor'::app_role)
      AND (NEW.centro IS NULL OR centro = NEW.centro OR role = 'admin'::app_role);
    
    -- Create notifications for each user
    IF v_user_ids IS NOT NULL THEN
      INSERT INTO alert_notifications (
        tipo, severidad, titulo, mensaje, centro, detalles, destinatario_user_id
      )
      SELECT
        'DQ_CRITICA',
        'critica',
        'Nueva incidencia crítica de calidad de datos',
        format('Se detectó un problema de tipo %s en %s', NEW.tipo, COALESCE(NEW.centro, 'todos los centros')),
        NEW.centro,
        to_jsonb(NEW),
        user_id
      FROM UNNEST(v_user_ids) AS user_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger for critical DQ issues
CREATE TRIGGER trigger_notify_critical_dq
AFTER INSERT ON dq_issues
FOR EACH ROW
EXECUTE FUNCTION public.notify_critical_dq_issue();