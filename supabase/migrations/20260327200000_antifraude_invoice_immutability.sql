-- =============================================================================
-- Ley Antifraude (Ley 11/2021) + RD 1007/2023 (Verifactu)
-- Migración: Inmutabilidad de facturas + Hash SHA-256 encadenado
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. BLOQUEO DE DELETE en facturas emitidas
--    Art. 29.2.j LGT: Software no puede permitir borrado de registros
--    Las facturas solo se anulan mediante factura rectificativa
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_invoice_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Ley Antifraude: No se permite eliminar facturas emitidas. Use una factura rectificativa (Art. 29.2.j LGT).';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_invoice_issued_delete ON invoices_issued;
CREATE TRIGGER trg_prevent_invoice_issued_delete
  BEFORE DELETE ON invoices_issued
  FOR EACH ROW
  EXECUTE FUNCTION prevent_invoice_delete();

-- -----------------------------------------------------------------------------
-- 2. BLOQUEO de modificación de campos fiscales en facturas ya firmadas
--    Una vez que verifactu_hash está establecido, los campos fiscales son inmutables
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_signed_invoice_modification()
RETURNS TRIGGER AS $$
BEGIN
  -- Si la factura ya tiene hash Verifactu, solo se permiten cambios administrativos
  IF OLD.verifactu_hash IS NOT NULL THEN
    -- Campos fiscales inmutables una vez firmados
    IF OLD.invoice_number IS DISTINCT FROM NEW.invoice_number
       OR OLD.invoice_series IS DISTINCT FROM NEW.invoice_series
       OR OLD.invoice_date IS DISTINCT FROM NEW.invoice_date
       OR OLD.customer_tax_id IS DISTINCT FROM NEW.customer_tax_id
       OR OLD.subtotal IS DISTINCT FROM NEW.subtotal
       OR OLD.tax_total IS DISTINCT FROM NEW.tax_total
       OR OLD.total IS DISTINCT FROM NEW.total
    THEN
      RAISE EXCEPTION 'Ley Antifraude: No se pueden modificar campos fiscales de una factura ya registrada en Verifactu. Emita una factura rectificativa.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_signed_invoice_modification ON invoices_issued;
CREATE TRIGGER trg_prevent_signed_invoice_modification
  BEFORE UPDATE ON invoices_issued
  FOR EACH ROW
  EXECUTE FUNCTION prevent_signed_invoice_modification();

-- -----------------------------------------------------------------------------
-- 3. HASH SHA-256 ENCADENADO (Verifactu Art. 8 RD 1007/2023)
--    Cada factura incluye el hash de la anterior, formando una cadena inmutable.
--    Campos del hash: serie+numero, fecha, NIF emisor, NIF receptor, base, cuota, total
-- -----------------------------------------------------------------------------

-- Necesitamos pgcrypto para digest/SHA-256
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION compute_verifactu_hash()
RETURNS TRIGGER AS $$
DECLARE
  v_previous_hash TEXT;
  v_nif_emisor TEXT;
  v_hash_input TEXT;
BEGIN
  -- Solo calcular si no viene ya con hash (para permitir migración de datos)
  IF NEW.verifactu_hash IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Obtener el hash de la última factura del mismo centro (cadena por centro)
  SELECT verifactu_hash INTO v_previous_hash
  FROM invoices_issued
  WHERE centro_code = NEW.centro_code
    AND verifactu_hash IS NOT NULL
  ORDER BY invoice_number DESC, created_at DESC
  LIMIT 1;

  -- Si no hay factura anterior, el hash previo es cadena vacía
  IF v_previous_hash IS NULL THEN
    v_previous_hash := '';
  END IF;

  -- Obtener NIF del emisor desde la tabla centres
  SELECT tax_id INTO v_nif_emisor
  FROM centres
  WHERE code = NEW.centro_code;

  IF v_nif_emisor IS NULL THEN
    v_nif_emisor := '';
  END IF;

  -- Construir la cadena de datos para el hash según especificación Verifactu:
  -- IDFactura (serie+numero) | FechaExpedicion | NIF_Emisor | NIF_Receptor |
  -- BaseImponible | CuotaTributaria | ImporteTotal | HashAnterior
  v_hash_input := COALESCE(NEW.invoice_series, '') || '-' || NEW.invoice_number::TEXT
    || '|' || NEW.invoice_date
    || '|' || v_nif_emisor
    || '|' || COALESCE(NEW.customer_tax_id, '')
    || '|' || COALESCE(NEW.subtotal, 0)::TEXT
    || '|' || COALESCE(NEW.tax_total, 0)::TEXT
    || '|' || NEW.total::TEXT
    || '|' || v_previous_hash;

  -- SHA-256 del input, codificado en hexadecimal
  NEW.verifactu_hash := encode(digest(v_hash_input, 'sha256'), 'hex');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_compute_verifactu_hash ON invoices_issued;
CREATE TRIGGER trg_compute_verifactu_hash
  BEFORE INSERT ON invoices_issued
  FOR EACH ROW
  EXECUTE FUNCTION compute_verifactu_hash();

-- -----------------------------------------------------------------------------
-- 4. NUMERACIÓN SECUENCIAL AUTOMÁTICA (sin huecos)
--    Art. 11.1 RD 1619/2012: Numeración correlativa dentro de cada serie
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION auto_invoice_number()
RETURNS TRIGGER AS $$
DECLARE
  v_next_number INTEGER;
  v_series TEXT;
  v_year INTEGER;
BEGIN
  v_series := COALESCE(NEW.invoice_series, 'F');
  v_year := EXTRACT(YEAR FROM NEW.invoice_date::DATE);

  -- Obtener o crear la secuencia para este centro/serie/año
  INSERT INTO invoice_sequences (centro_code, invoice_type, series, year, last_number)
  VALUES (NEW.centro_code, 'issued', v_series, v_year, 0)
  ON CONFLICT (centro_code, invoice_type, series, year)
  DO NOTHING;

  -- Incrementar atómicamente (serializable para evitar huecos)
  UPDATE invoice_sequences
  SET last_number = last_number + 1,
      updated_at = NOW()
  WHERE centro_code = NEW.centro_code
    AND invoice_type = 'issued'
    AND series = v_series
    AND year = v_year
  RETURNING last_number INTO v_next_number;

  NEW.invoice_number := v_next_number;
  NEW.full_invoice_number := v_series || '-' || v_year || '-' || LPAD(v_next_number::TEXT, 6, '0');
  NEW.invoice_series := v_series;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_invoice_number ON invoices_issued;
CREATE TRIGGER trg_auto_invoice_number
  BEFORE INSERT ON invoices_issued
  FOR EACH ROW
  EXECUTE FUNCTION auto_invoice_number();

-- -----------------------------------------------------------------------------
-- 5. TABLA DE FACTURAS RECTIFICATIVAS
--    Art. 15 RD 1619/2012: Facturas rectificativas en lugar de borrado
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoices_rectificativas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Referencia a la factura original
  original_invoice_id UUID NOT NULL REFERENCES invoices_issued(id),
  -- Nueva factura rectificativa (misma estructura, nueva numeración)
  rectificativa_invoice_id UUID NOT NULL REFERENCES invoices_issued(id),
  -- Motivo de la rectificación (Art. 15.1 RD 1619/2012)
  motivo TEXT NOT NULL CHECK (motivo IN (
    'error_datos_obligatorios',     -- Art. 15.1.a: Error en datos obligatorios
    'incumplimiento_art6_7',        -- Art. 15.1.b: Incumplimiento art. 6 o 7
    'devolucion',                   -- Devolución de mercancía
    'descuento_bonificacion',       -- Descuentos/bonificaciones posteriores
    'resolucion_firme_judicial',    -- Resolución judicial
    'auto_judicial_concursal',      -- Auto judicial concursal
    'creditos_incobrables'          -- Créditos total o parcialmente incobrables
  )),
  -- Método de rectificación
  metodo_rectificacion TEXT NOT NULL DEFAULT 'sustitucion' CHECK (metodo_rectificacion IN (
    'sustitucion',     -- Art. 14.1: Se sustituyen los datos originales
    'diferencias'      -- Art. 14.2: Se indican las diferencias
  )),
  descripcion TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Índice para buscar rectificativas de una factura original
CREATE INDEX IF NOT EXISTS idx_rectificativas_original ON invoices_rectificativas(original_invoice_id);

-- Al crear una rectificativa, marcar la factura original como anulada/rectificada
CREATE OR REPLACE FUNCTION mark_invoice_as_rectified()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE invoices_issued
  SET status = 'rectificada',
      updated_at = NOW()
  WHERE id = NEW.original_invoice_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mark_invoice_rectified ON invoices_rectificativas;
CREATE TRIGGER trg_mark_invoice_rectified
  AFTER INSERT ON invoices_rectificativas
  FOR EACH ROW
  EXECUTE FUNCTION mark_invoice_as_rectified();

-- -----------------------------------------------------------------------------
-- 6. REGISTRO DE EVENTOS DEL SISTEMA (Art. 8.1.d RD 1007/2023)
--    Verifactu requiere log de eventos: alta/baja facturas, errores del sistema
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS verifactu_event_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'invoice_created',
    'invoice_rectified',
    'hash_computed',
    'aeat_submission_attempt',
    'aeat_submission_success',
    'aeat_submission_error',
    'system_start',
    'system_error',
    'config_change'
  )),
  invoice_id UUID REFERENCES invoices_issued(id),
  centro_code TEXT,
  details JSONB,
  user_id UUID REFERENCES auth.users(id),
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_verifactu_events_type ON verifactu_event_log(event_type);
CREATE INDEX IF NOT EXISTS idx_verifactu_events_invoice ON verifactu_event_log(invoice_id);
CREATE INDEX IF NOT EXISTS idx_verifactu_events_date ON verifactu_event_log(created_at);

-- RLS: Solo admin puede leer, solo el sistema puede insertar
ALTER TABLE verifactu_event_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices_rectificativas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_read_verifactu_events" ON verifactu_event_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "admin_read_rectificativas" ON invoices_rectificativas
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "admin_insert_rectificativas" ON invoices_rectificativas
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'gestor')
    )
  );

-- Trigger para loguear creación de facturas automáticamente
CREATE OR REPLACE FUNCTION log_invoice_created()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO verifactu_event_log (event_type, invoice_id, centro_code, details, user_id)
  VALUES (
    'invoice_created',
    NEW.id,
    NEW.centro_code,
    jsonb_build_object(
      'full_invoice_number', NEW.full_invoice_number,
      'total', NEW.total,
      'verifactu_hash', NEW.verifactu_hash
    ),
    NEW.created_by
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_log_invoice_created ON invoices_issued;
CREATE TRIGGER trg_log_invoice_created
  AFTER INSERT ON invoices_issued
  FOR EACH ROW
  EXECUTE FUNCTION log_invoice_created();
