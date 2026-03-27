/**
 * Verifactu - Cumplimiento Ley Antifraude (Ley 11/2021) + RD 1007/2023
 *
 * Utilidades para:
 * - Cálculo de hash SHA-256 encadenado (Art. 8 RD 1007/2023)
 * - Generación de URL de verificación / QR (Art. 13 RD 1007/2023)
 * - Validación de datos fiscales obligatorios
 */

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface VerifactuInvoiceData {
  /** Serie de factura (ej: "F", "R") */
  invoiceSeries: string;
  /** Número de factura */
  invoiceNumber: number;
  /** Fecha de expedición (YYYY-MM-DD) */
  invoiceDate: string;
  /** NIF del emisor */
  issuerTaxId: string;
  /** NIF del receptor */
  recipientTaxId: string;
  /** Base imponible total */
  subtotal: number;
  /** Cuota tributaria total (IVA + recargos) */
  taxTotal: number;
  /** Importe total */
  total: number;
}

export interface VerifactuHashResult {
  /** Hash SHA-256 en hexadecimal */
  hash: string;
  /** Cadena de datos usada para el cálculo */
  hashInput: string;
}

export interface VerifactuQRData {
  /** URL de verificación AEAT */
  url: string;
  /** Datos codificados para el QR */
  payload: string;
}

export type MotivosRectificacion =
  | "error_datos_obligatorios"
  | "incumplimiento_art6_7"
  | "devolucion"
  | "descuento_bonificacion"
  | "resolucion_firme_judicial"
  | "auto_judicial_concursal"
  | "creditos_incobrables";

export type MetodoRectificacion = "sustitucion" | "diferencias";

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

/** URL base de verificación de la AEAT para Verifactu */
const AEAT_VERIFACTU_BASE_URL = "https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR";

/** Campos obligatorios según Art. 6 RD 1619/2012 */
const REQUIRED_INVOICE_FIELDS: (keyof VerifactuInvoiceData)[] = [
  "invoiceSeries",
  "invoiceNumber",
  "invoiceDate",
  "issuerTaxId",
  "total",
];

// ---------------------------------------------------------------------------
// Hash SHA-256 encadenado
// ---------------------------------------------------------------------------

/**
 * Calcula el hash SHA-256 encadenado según especificación Verifactu.
 *
 * La cadena de entrada sigue el formato:
 * IDFactura | FechaExpedicion | NIF_Emisor | NIF_Receptor | Base | Cuota | Total | HashAnterior
 *
 * Nota: Este cálculo se realiza también en el trigger de PostgreSQL (compute_verifactu_hash).
 * Esta función cliente permite verificar la integridad del hash localmente.
 */
export async function computeVerifactuHash(
  invoiceData: VerifactuInvoiceData,
  previousHash: string = ""
): Promise<VerifactuHashResult> {
  const hashInput = buildHashInput(invoiceData, previousHash);

  const encoder = new TextEncoder();
  const data = encoder.encode(hashInput);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  return { hash, hashInput };
}

/**
 * Construye la cadena de datos para el hash (determinista, separada por pipes).
 */
export function buildHashInput(
  data: VerifactuInvoiceData,
  previousHash: string = ""
): string {
  return [
    `${data.invoiceSeries}-${data.invoiceNumber}`,
    data.invoiceDate,
    data.issuerTaxId,
    data.recipientTaxId || "",
    data.subtotal.toString(),
    data.taxTotal.toString(),
    data.total.toString(),
    previousHash,
  ].join("|");
}

/**
 * Verifica que un hash coincide con los datos de la factura.
 * Útil para auditoría y verificación de integridad de la cadena.
 */
export async function verifyVerifactuHash(
  invoiceData: VerifactuInvoiceData,
  expectedHash: string,
  previousHash: string = ""
): Promise<boolean> {
  const { hash } = await computeVerifactuHash(invoiceData, previousHash);
  return hash === expectedHash;
}

// ---------------------------------------------------------------------------
// QR de verificación (Art. 13 RD 1007/2023)
// ---------------------------------------------------------------------------

/**
 * Genera la URL de verificación AEAT para incluir en el QR de la factura.
 *
 * Formato según especificación técnica Verifactu:
 * https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR?nif=X&numserie=Y&fecha=Z&importe=W
 */
export function generateVerifactuQR(
  issuerTaxId: string,
  fullInvoiceNumber: string,
  invoiceDate: string,
  total: number
): VerifactuQRData {
  const params = new URLSearchParams({
    nif: issuerTaxId,
    numserie: fullInvoiceNumber,
    fecha: formatDateForAEAT(invoiceDate),
    importe: total.toFixed(2),
  });

  const url = `${AEAT_VERIFACTU_BASE_URL}?${params.toString()}`;

  return {
    url,
    payload: params.toString(),
  };
}

// ---------------------------------------------------------------------------
// Validaciones fiscales
// ---------------------------------------------------------------------------

export interface InvoiceValidationError {
  field: string;
  message: string;
}

/**
 * Valida que una factura cumple los requisitos mínimos de la Ley Antifraude.
 * Retorna lista vacía si es válida.
 */
export function validateInvoiceForVerifactu(
  data: Partial<VerifactuInvoiceData>
): InvoiceValidationError[] {
  const errors: InvoiceValidationError[] = [];

  for (const field of REQUIRED_INVOICE_FIELDS) {
    const value = data[field];
    if (value === undefined || value === null || value === "") {
      errors.push({
        field,
        message: `Campo obligatorio "${field}" es requerido (Art. 6 RD 1619/2012)`,
      });
    }
  }

  // Validar NIF emisor (formato español)
  if (data.issuerTaxId && !isValidSpanishTaxId(data.issuerTaxId)) {
    errors.push({
      field: "issuerTaxId",
      message: "NIF/CIF del emisor no tiene formato válido",
    });
  }

  // Validar NIF receptor si está presente
  if (data.recipientTaxId && data.recipientTaxId.length > 0 && !isValidSpanishTaxId(data.recipientTaxId)) {
    errors.push({
      field: "recipientTaxId",
      message: "NIF/CIF del receptor no tiene formato válido",
    });
  }

  // Validar fecha
  if (data.invoiceDate && !isValidDateFormat(data.invoiceDate)) {
    errors.push({
      field: "invoiceDate",
      message: "Fecha debe tener formato YYYY-MM-DD",
    });
  }

  // Validar coherencia de importes
  if (
    data.subtotal !== undefined &&
    data.taxTotal !== undefined &&
    data.total !== undefined
  ) {
    const expectedTotal = roundToTwo(data.subtotal + data.taxTotal);
    if (Math.abs(expectedTotal - data.total) > 0.01) {
      errors.push({
        field: "total",
        message: `Total (${data.total}) no coincide con base + cuota (${expectedTotal})`,
      });
    }
  }

  // Validar que el importe total no es negativo (excepto rectificativas)
  if (data.total !== undefined && data.total < 0) {
    errors.push({
      field: "total",
      message: "El total no puede ser negativo. Use una factura rectificativa para correcciones.",
    });
  }

  return errors;
}

/**
 * Valida un NIF/CIF/NIE español.
 * Formatos aceptados:
 * - NIF: 8 dígitos + letra (12345678A)
 * - CIF: letra + 7 dígitos + dígito/letra (B12345678)
 * - NIE: X/Y/Z + 7 dígitos + letra (X1234567A)
 */
export function isValidSpanishTaxId(taxId: string): boolean {
  if (!taxId || taxId.length < 8 || taxId.length > 9) return false;
  const cleaned = taxId.toUpperCase().replace(/[\s-]/g, "");
  // NIF personal
  const nifRegex = /^[0-9]{8}[A-Z]$/;
  // CIF empresa
  const cifRegex = /^[ABCDEFGHJKLMNPQRSUVW][0-9]{7}[0-9A-J]$/;
  // NIE extranjero
  const nieRegex = /^[XYZ][0-9]{7}[A-Z]$/;

  return nifRegex.test(cleaned) || cifRegex.test(cleaned) || nieRegex.test(cleaned);
}

/**
 * Calcula la letra de control de un NIF español.
 */
export function calculateNIFLetter(dniNumber: number): string {
  const letters = "TRWAGMYFPDXBNJZSQVHLCKE";
  return letters[dniNumber % 23];
}

// ---------------------------------------------------------------------------
// Motivos de rectificación (Art. 15 RD 1619/2012)
// ---------------------------------------------------------------------------

export const MOTIVOS_RECTIFICACION: Record<MotivosRectificacion, string> = {
  error_datos_obligatorios: "Error en datos obligatorios de la factura (Art. 15.1.a)",
  incumplimiento_art6_7: "Incumplimiento de los artículos 6 o 7 (Art. 15.1.b)",
  devolucion: "Devolución de mercancía o prestación no realizada",
  descuento_bonificacion: "Descuentos o bonificaciones posteriores a la emisión",
  resolucion_firme_judicial: "Resolución firme judicial o administrativa",
  auto_judicial_concursal: "Auto judicial declaración de concurso",
  creditos_incobrables: "Créditos total o parcialmente incobrables (Art. 80.4 LIVA)",
};

// ---------------------------------------------------------------------------
// Utilidades internas
// ---------------------------------------------------------------------------

function formatDateForAEAT(isoDate: string): string {
  // AEAT espera DD-MM-YYYY
  const [year, month, day] = isoDate.split("-");
  return `${day}-${month}-${year}`;
}

function isValidDateFormat(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(Date.parse(date));
}

function roundToTwo(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}
