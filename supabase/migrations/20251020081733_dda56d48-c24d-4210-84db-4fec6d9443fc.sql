-- ============================================================================
-- Asignar rol admin al usuario actual y configurar trigger automático
-- ============================================================================

-- Paso 1: Asignar rol admin al usuario s.navarro@obn.es
-- El constraint único es (user_id, role, centro), así que especificamos centro = NULL para admin
INSERT INTO user_roles (user_id, role, centro)
VALUES ('dc0a8c1f-27cb-4437-8f1c-10724ff44421', 'admin', NULL)
ON CONFLICT (user_id, role, centro) DO NOTHING;

-- Paso 2: Crear trigger para asignar admin automáticamente al primer usuario
-- (si no existe ya)
DROP TRIGGER IF EXISTS on_first_user_assign_admin ON profiles;

CREATE TRIGGER on_first_user_assign_admin
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION assign_first_admin();

-- Verificación
DO $$
DECLARE
  v_email TEXT;
  v_nombre TEXT;
  v_apellidos TEXT;
  v_role app_role;
  v_created_at TIMESTAMPTZ;
BEGIN
  -- Verificar que el usuario tiene el rol admin
  SELECT 
    p.email,
    p.nombre,
    p.apellidos,
    ur.role,
    ur.created_at
  INTO v_email, v_nombre, v_apellidos, v_role, v_created_at
  FROM profiles p
  JOIN user_roles ur ON ur.user_id = p.id
  WHERE p.id = 'dc0a8c1f-27cb-4437-8f1c-10724ff44421'
    AND ur.role = 'admin';
  
  IF v_email IS NOT NULL THEN
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ ROL ADMIN ASIGNADO CORRECTAMENTE';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Usuario: % % (%)', v_nombre, v_apellidos, v_email;
    RAISE NOTICE 'Rol: %', v_role;
    RAISE NOTICE 'Asignado el: %', v_created_at;
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ Trigger creado: on_first_user_assign_admin';
    RAISE NOTICE '========================================';
  ELSE
    RAISE WARNING '⚠️ No se pudo verificar el rol admin para el usuario';
  END IF;
END $$;