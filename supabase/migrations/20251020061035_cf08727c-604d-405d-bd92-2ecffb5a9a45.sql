-- ============================================================================
-- Corrección de duplicados y limpieza de comillas dobles (")
-- ============================================================================
-- Paso 1: Consolidar franquiciados RMSAU duplicados
-- Paso 2: Limpiar todas las comillas de la base de datos
-- ============================================================================

-- PASO 1A: Consolidar franquiciados RMSAU
-- Franquiciado correcto (más antiguo, 25 restaurantes): 0cfaab82-5ee5-4587-b8f1-4508d54c92af
-- Franquiciado duplicado (11 restaurantes): f710ed97-a620-4799-8745-991e3da51240

-- Reasignar los 11 restaurantes del duplicado al correcto
UPDATE centres
SET 
  franchisee_id = '0cfaab82-5ee5-4587-b8f1-4508d54c92af',
  updated_at = now()
WHERE franchisee_id = 'f710ed97-a620-4799-8745-991e3da51240';

-- Eliminar el franquiciado duplicado
DELETE FROM franchisees
WHERE id = 'f710ed97-a620-4799-8745-991e3da51240';

-- PASO 1B: Limpiar comillas del franquiciado RMSAU correcto
UPDATE franchisees
SET 
  name = REPLACE(name, '"', ''),
  email = REPLACE(email, '"', ''),
  updated_at = now()
WHERE id = '0cfaab82-5ee5-4587-b8f1-4508d54c92af';

-- PASO 2: Limpiar tabla franchisees (resto de registros)
UPDATE franchisees
SET 
  name = REPLACE(name, '"', ''),
  email = REPLACE(email, '"', ''),
  company_tax_id = REPLACE(COALESCE(company_tax_id, ''), '"', ''),
  updated_at = now()
WHERE 
  id != '0cfaab82-5ee5-4587-b8f1-4508d54c92af'
  AND (
    name LIKE '%"%' 
    OR email LIKE '%"%'
    OR company_tax_id LIKE '%"%'
  );

-- PASO 3: Limpiar tabla centres (restaurantes)
UPDATE centres
SET 
  codigo = REPLACE(codigo, '"', ''),
  nombre = REPLACE(nombre, '"', ''),
  ciudad = REPLACE(COALESCE(ciudad, ''), '"', ''),
  direccion = REPLACE(COALESCE(direccion, ''), '"', ''),
  franchisee_name = REPLACE(COALESCE(franchisee_name, ''), '"', ''),
  site_number = REPLACE(COALESCE(site_number, ''), '"', ''),
  state = REPLACE(COALESCE(state, ''), '"', ''),
  pais = REPLACE(COALESCE(pais, ''), '"', ''),
  postal_code = REPLACE(COALESCE(postal_code, ''), '"', ''),
  updated_at = now()
WHERE 
  codigo LIKE '%"%'
  OR nombre LIKE '%"%'
  OR ciudad LIKE '%"%'
  OR direccion LIKE '%"%'
  OR franchisee_name LIKE '%"%'
  OR site_number LIKE '%"%'
  OR state LIKE '%"%'
  OR pais LIKE '%"%'
  OR postal_code LIKE '%"%';

-- VERIFICACIÓN FINAL
DO $$
DECLARE
  v_rmsau_count INTEGER;
  v_franchisees_count INTEGER;
  v_centres_count INTEGER;
BEGIN
  -- Verificar consolidación RMSAU
  SELECT COUNT(*) INTO v_rmsau_count
  FROM centres
  WHERE franchisee_id = '0cfaab82-5ee5-4587-b8f1-4508d54c92af';
  
  -- Contar comillas en franchisees
  SELECT COUNT(*) INTO v_franchisees_count
  FROM franchisees
  WHERE 
    name LIKE '%"%' 
    OR email LIKE '%"%'
    OR company_tax_id LIKE '%"%';
  
  -- Contar comillas en centres
  SELECT COUNT(*) INTO v_centres_count
  FROM centres
  WHERE 
    codigo LIKE '%"%'
    OR nombre LIKE '%"%'
    OR ciudad LIKE '%"%'
    OR direccion LIKE '%"%'
    OR franchisee_name LIKE '%"%'
    OR site_number LIKE '%"%'
    OR state LIKE '%"%'
    OR pais LIKE '%"%'
    OR postal_code LIKE '%"%';
  
  RAISE NOTICE '✅ Consolidación RMSAU completada: % restaurantes', v_rmsau_count;
  RAISE NOTICE '✅ Limpieza completada';
  RAISE NOTICE '   - Franchisees con comillas restantes: %', v_franchisees_count;
  RAISE NOTICE '   - Centres con comillas restantes: %', v_centres_count;
  
  IF v_rmsau_count != 36 THEN
    RAISE WARNING '⚠️ RMSAU debería tener 36 restaurantes, tiene %', v_rmsau_count;
  END IF;
  
  IF v_franchisees_count > 0 OR v_centres_count > 0 THEN
    RAISE WARNING '⚠️ Aún quedan comillas en % registros', (v_franchisees_count + v_centres_count);
  END IF;
END $$;