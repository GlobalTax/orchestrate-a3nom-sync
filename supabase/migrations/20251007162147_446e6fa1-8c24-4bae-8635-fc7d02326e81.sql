-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'gestor');

-- Create employees table
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id_orquest TEXT UNIQUE,
  codtrabajador_a3nom TEXT UNIQUE,
  nombre TEXT NOT NULL,
  apellidos TEXT NOT NULL,
  email TEXT,
  centro TEXT,
  fecha_alta DATE,
  fecha_baja DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create schedules table
CREATE TABLE public.schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
  fecha DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  horas_planificadas DECIMAL(5,2) NOT NULL,
  tipo_asignacion TEXT,
  service_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create absences table
CREATE TABLE public.absences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
  fecha DATE NOT NULL,
  horas_ausencia DECIMAL(5,2) NOT NULL,
  tipo TEXT NOT NULL,
  motivo TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create payrolls table
CREATE TABLE public.payrolls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
  periodo_inicio DATE NOT NULL,
  periodo_fin DATE NOT NULL,
  horas_trabajadas DECIMAL(7,2),
  horas_vacaciones DECIMAL(5,2),
  horas_formacion DECIMAL(5,2),
  coste_total DECIMAL(10,2),
  desglose_costes JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  centro TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Create profiles table for user metadata
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT,
  apellidos TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.absences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payrolls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create function to check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS Policies for employees
CREATE POLICY "Admins can manage all employees"
  ON public.employees FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Gestores can view employees in their centro"
  ON public.employees FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'gestor') AND 
    centro IN (SELECT centro FROM public.user_roles WHERE user_id = auth.uid())
  );

-- RLS Policies for schedules
CREATE POLICY "Admins can manage all schedules"
  ON public.schedules FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Gestores can view schedules for their centro employees"
  ON public.schedules FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e
      INNER JOIN public.user_roles ur ON e.centro = ur.centro
      WHERE e.id = schedules.employee_id
        AND ur.user_id = auth.uid()
        AND ur.role = 'gestor'
    )
  );

-- RLS Policies for absences
CREATE POLICY "Admins can manage all absences"
  ON public.absences FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Gestores can view absences for their centro employees"
  ON public.absences FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e
      INNER JOIN public.user_roles ur ON e.centro = ur.centro
      WHERE e.id = absences.employee_id
        AND ur.user_id = auth.uid()
        AND ur.role = 'gestor'
    )
  );

-- RLS Policies for payrolls
CREATE POLICY "Admins can manage all payrolls"
  ON public.payrolls FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Gestores can view payrolls for their centro employees"
  ON public.payrolls FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e
      INNER JOIN public.user_roles ur ON e.centro = ur.centro
      WHERE e.id = payrolls.employee_id
        AND ur.user_id = auth.uid()
        AND ur.role = 'gestor'
    )
  );

-- RLS Policies for user_roles
CREATE POLICY "Admins can manage all user roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- RLS Policies for profiles
CREATE POLICY "Users can view and update their own profile"
  ON public.profiles FOR ALL
  TO authenticated
  USING (id = auth.uid());

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nombre, apellidos, email)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'nombre',
    NEW.raw_user_meta_data->>'apellidos',
    NEW.email
  );
  RETURN NEW;
END;
$$;

-- Trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Triggers for updated_at
CREATE TRIGGER update_employees_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_schedules_employee_fecha ON public.schedules(employee_id, fecha);
CREATE INDEX idx_absences_employee_fecha ON public.absences(employee_id, fecha);
CREATE INDEX idx_payrolls_employee_periodo ON public.payrolls(employee_id, periodo_inicio, periodo_fin);
CREATE INDEX idx_employees_centro ON public.employees(centro);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);