-- ============================================================================
-- Asignar rol gestor para todos los restaurantes activos a s.navarro@obn.es
-- ============================================================================

-- Insertar rol gestor para cada restaurante activo
INSERT INTO user_roles (user_id, role, centro)
SELECT 
  'dc0a8c1f-27cb-4437-8f1c-10724ff44421'::uuid,
  'gestor'::app_role,
  c.codigo
FROM centres c
WHERE c.activo = true
ON CONFLICT (user_id, role, centro) DO NOTHING;

-- Verificación del resultado
DO $$
DECLARE
  v_count INTEGER;
  v_email TEXT;
  v_nombre TEXT;
BEGIN
  -- Contar asignaciones de gestor
  SELECT COUNT(*)
  INTO v_count
  FROM user_roles
  WHERE user_id = 'dc0a8c1f-27cb-4437-8f1c-10724ff44421'
    AND role = 'gestor';
  
  -- Obtener datos del usuario
  SELECT email, nombre
  INTO v_email, v_nombre
  FROM profiles
  WHERE id = 'dc0a8c1f-27cb-4437-8f1c-10724ff44421';
  
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ ROL GESTOR ASIGNADO A TODOS LOS RESTAURANTES';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Usuario: % (%)', v_nombre, v_email;
  RAISE NOTICE 'Total restaurantes asignados: %', v_count;
  RAISE NOTICE '========================================';
END $$;