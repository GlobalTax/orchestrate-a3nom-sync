-- ============================================================================
-- Corrección de franquiciados duplicados: Cazorla
-- ============================================================================
-- Este script consolida 3 franquiciados Cazorla en uno solo y reasigna
-- los 8 restaurantes al franquiciado correcto.
-- ============================================================================

-- PASO 1: Reasignar los 8 restaurantes al franquiciado correcto
-- Franquiciado correcto: 3ce92f1b-de6d-4aa3-983b-a973d0686e34
-- Duplicados a eliminar: b906a866... (7 rest.) y 454d80c7... (1 rest.)

UPDATE centres
SET 
  franchisee_id = '3ce92f1b-de6d-4aa3-983b-a973d0686e34',
  updated_at = now()
WHERE franchisee_id IN (
  'b906a866-0a39-42b9-9ace-bf1a0810a979',
  '454d80c7-c986-4e35-acf1-c89dd270252c'
);

-- PASO 2: Limpiar datos del franquiciado correcto
-- Asegurar que tenga email y CIF correcto

UPDATE franchisees
SET 
  email = 'joanramon.cazorla@es.mcd.com',
  updated_at = now()
WHERE id = '3ce92f1b-de6d-4aa3-983b-a973d0686e34';

-- PASO 3: Eliminar franquiciados duplicados
-- Solo después de reasignar restaurantes

DELETE FROM franchisees
WHERE id IN (
  'b906a866-0a39-42b9-9ace-bf1a0810a979',
  '454d80c7-c986-4e35-acf1-c89dd270252c'
);

-- VERIFICACIÓN: Contar restaurantes del franquiciado correcto
-- Debería mostrar 8 restaurantes

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM centres
  WHERE franchisee_id = '3ce92f1b-de6d-4aa3-983b-a973d0686e34';
  
  RAISE NOTICE '✅ Restaurantes vinculados a Cazorla: %', v_count;
  
  IF v_count != 8 THEN
    RAISE WARNING '⚠️ Se esperaban 8 restaurantes, pero hay %', v_count;
  END IF;
END $$;