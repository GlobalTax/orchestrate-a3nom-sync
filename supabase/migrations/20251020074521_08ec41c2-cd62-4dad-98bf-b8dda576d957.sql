-- ============================================================================
-- Limpieza del CIF de RMSAU (Restaurantes McDonald's S.A. Unipersonal)
-- ============================================================================

-- Limpiar el company_tax_id de RMSAU (eliminar comillas)
UPDATE franchisees
SET 
  company_tax_id = REPLACE(company_tax_id, '"', ''),
  updated_at = now()
WHERE id = '0cfaab82-5ee5-4587-b8f1-4508d54c92af';

-- Verificación
DO $$
DECLARE
  v_name TEXT;
  v_email TEXT;
  v_cif TEXT;
  v_business_id TEXT;
  v_restaurant_count INTEGER;
BEGIN
  -- Obtener datos del franquiciado
  SELECT name, email, company_tax_id, orquest_business_id
  INTO v_name, v_email, v_cif, v_business_id
  FROM franchisees
  WHERE id = '0cfaab82-5ee5-4587-b8f1-4508d54c92af';
  
  -- Contar restaurantes vinculados
  SELECT COUNT(*)
  INTO v_restaurant_count
  FROM centres
  WHERE franchisee_id = '0cfaab82-5ee5-4587-b8f1-4508d54c92af';
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'FRANQUICIADO: RMSAU';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Nombre: %', v_name;
  RAISE NOTICE 'Email: %', v_email;
  RAISE NOTICE 'CIF: %', v_cif;
  RAISE NOTICE 'Orquest Business ID: %', v_business_id;
  RAISE NOTICE 'Restaurantes vinculados: %', v_restaurant_count;
  RAISE NOTICE '========================================';
  
  -- Verificar que no quedan comillas
  IF v_cif LIKE '%"%' THEN
    RAISE WARNING '⚠️ El CIF aún contiene comillas: %', v_cif;
  ELSE
    RAISE NOTICE '✅ CIF limpio (sin comillas)';
  END IF;
  
  IF v_restaurant_count = 36 THEN
    RAISE NOTICE '✅ 36 restaurantes vinculados correctamente';
  ELSE
    RAISE WARNING '⚠️ Se esperaban 36 restaurantes, se encontraron %', v_restaurant_count;
  END IF;
END $$;