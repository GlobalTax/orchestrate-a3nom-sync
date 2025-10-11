-- Asignar usuario s.navarro@obn.es como superadmin
INSERT INTO public.user_roles (user_id, role, centro)
VALUES ('dc0a8c1f-27cb-4437-8f1c-10724ff44421', 'admin'::app_role, NULL)
ON CONFLICT DO NOTHING;

-- Función para auto-asignar admin al primer usuario
CREATE OR REPLACE FUNCTION public.assign_first_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin'::app_role) THEN
    INSERT INTO public.user_roles (user_id, role, centro)
    VALUES (NEW.id, 'admin'::app_role, NULL);
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger para ejecutar la función en nuevos usuarios
DROP TRIGGER IF EXISTS on_auth_user_created_assign_first_admin ON auth.users;
CREATE TRIGGER on_auth_user_created_assign_first_admin
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_first_admin();

-- Asegurar política RLS para que admins puedan gestionar roles
DROP POLICY IF EXISTS "Admins can manage all user roles" ON public.user_roles;
CREATE POLICY "Admins can manage all user roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));