-- Fix user_roles schema to support multiple centro assignments per role
-- Step 1: Drop the old unique constraint that only considers (user_id, role)
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_role_key;

-- Step 2: Add new unique constraint that includes centro
-- This allows admins to have multiple entries for different centros
ALTER TABLE user_roles ADD CONSTRAINT user_roles_user_role_centro_key 
  UNIQUE (user_id, role, centro);

-- Step 3: Now insert all active restaurant codes for the admin
INSERT INTO user_roles (user_id, role, centro)
SELECT 
  'dc0a8c1f-27cb-4437-8f1c-10724ff44421'::uuid,
  'admin'::app_role,
  c.codigo
FROM centres c
WHERE c.activo = true
  AND NOT EXISTS (
    SELECT 1 
    FROM user_roles ur 
    WHERE ur.user_id = 'dc0a8c1f-27cb-4437-8f1c-10724ff44421'
      AND ur.role = 'admin'
      AND ur.centro = c.codigo
  );