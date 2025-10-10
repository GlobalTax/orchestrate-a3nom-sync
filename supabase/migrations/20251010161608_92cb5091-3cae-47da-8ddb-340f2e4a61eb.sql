-- Create restaurant_cost_centres table for N:M mapping between Orquest services and A3Nom centers
CREATE TABLE IF NOT EXISTS public.restaurant_cost_centres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  centro_id UUID NOT NULL REFERENCES public.centres(id) ON DELETE CASCADE,
  a3_centro_code TEXT NOT NULL,
  descripcion TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(centro_id, a3_centro_code)
);

-- Enable RLS
ALTER TABLE public.restaurant_cost_centres ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage all restaurant_cost_centres"
  ON public.restaurant_cost_centres
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view restaurant_cost_centres for their accessible centres"
  ON public.restaurant_cost_centres
  FOR SELECT
  USING (
    centro_id IN (
      SELECT c.id
      FROM centres c
      WHERE c.codigo IN (
        SELECT centro_code FROM v_user_centres WHERE user_id = auth.uid()
      )
    )
  );

-- Add trigger for updated_at
CREATE TRIGGER update_restaurant_cost_centres_updated_at
  BEFORE UPDATE ON public.restaurant_cost_centres
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for performance
CREATE INDEX idx_restaurant_cost_centres_centro_id ON public.restaurant_cost_centres(centro_id);
CREATE INDEX idx_restaurant_cost_centres_a3_code ON public.restaurant_cost_centres(a3_centro_code);

-- Add audit trigger
CREATE TRIGGER audit_restaurant_cost_centres
  AFTER INSERT OR UPDATE OR DELETE ON public.restaurant_cost_centres
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_trigger();

COMMENT ON TABLE public.restaurant_cost_centres IS 'N:M mapping between Orquest centres and A3Nom cost centers for payroll import';
COMMENT ON COLUMN public.restaurant_cost_centres.centro_id IS 'Reference to centres table (Orquest service)';
COMMENT ON COLUMN public.restaurant_cost_centres.a3_centro_code IS 'A3Nom center code for payroll mapping';