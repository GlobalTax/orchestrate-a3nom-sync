-- Asignar usuario actual como superadmin
INSERT INTO public.user_roles (user_id, role, centro)
VALUES ('dc0a8c1f-27cb-4437-8f1c-10724ff44421', 'admin', NULL)
ON CONFLICT DO NOTHING;

-- Función para auto-asignar primer admin
CREATE OR REPLACE FUNCTION public.assign_first_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Si no existe ningún admin, asignar rol admin al nuevo usuario
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin'::app_role) THEN
    INSERT INTO public.user_roles (user_id, role, centro)
    VALUES (NEW.id, 'admin'::app_role, NULL);
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger para ejecutar la función cuando se crea un usuario
DROP TRIGGER IF EXISTS on_auth_user_created_assign_first_admin ON auth.users;
CREATE TRIGGER on_auth_user_created_assign_first_admin
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_first_admin();