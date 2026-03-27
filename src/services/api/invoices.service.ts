import { supabase } from "@/integrations/supabase/client";
import type {
  VerifactuInvoiceData,
  MotivosRectificacion,
  MetodoRectificacion,
} from "@/lib/verifactu";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InvoiceIssued {
  id: string;
  centro_code: string;
  invoice_number: number;
  invoice_series: string | null;
  full_invoice_number: string | null;
  invoice_date: string;
  customer_name: string;
  customer_tax_id: string | null;
  customer_email: string | null;
  customer_address: string | null;
  due_date: string | null;
  subtotal: number | null;
  tax_total: number | null;
  total: number;
  status: string | null;
  notes: string | null;
  pdf_path: string | null;
  sent_at: string | null;
  paid_at: string | null;
  verifactu_hash: string | null;
  verifactu_signed: boolean | null;
  verifactu_sent_at: string | null;
  verifactu_sent_to_aeat: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  created_by: string | null;
}

export interface InvoiceLine {
  description: string;
  quantity: number;
  unit_price: number;
  discount_percentage?: number;
  tax_rate: number;
  tax_code_id?: string;
  recargo_equivalencia?: number;
  retencion_percentage?: number;
  account_code?: string;
}

export interface CreateInvoiceInput {
  centro_code: string;
  invoice_date: string;
  invoice_series?: string;
  customer_name: string;
  customer_tax_id?: string;
  customer_email?: string;
  customer_address?: string;
  due_date?: string;
  notes?: string;
  lines: InvoiceLine[];
}

export interface InvoiceRectificativa {
  id: string;
  original_invoice_id: string;
  rectificativa_invoice_id: string;
  motivo: MotivosRectificacion;
  metodo_rectificacion: MetodoRectificacion;
  descripcion: string | null;
  created_at: string | null;
  created_by: string | null;
}

export interface CreateRectificativaInput {
  original_invoice_id: string;
  motivo: MotivosRectificacion;
  metodo_rectificacion?: MetodoRectificacion;
  descripcion?: string;
  /** Líneas de la factura rectificativa (corrección) */
  lines: InvoiceLine[];
}

// ---------------------------------------------------------------------------
// Cálculos de línea
// ---------------------------------------------------------------------------

function calculateLineTotals(line: InvoiceLine) {
  const subtotal = roundToTwo(line.quantity * line.unit_price);
  const discountAmount = line.discount_percentage
    ? roundToTwo(subtotal * (line.discount_percentage / 100))
    : 0;
  const taxableBase = roundToTwo(subtotal - discountAmount);
  const taxAmount = roundToTwo(taxableBase * (line.tax_rate / 100));
  const recargoAmount = line.recargo_equivalencia
    ? roundToTwo(taxableBase * (line.recargo_equivalencia / 100))
    : 0;
  const retencionAmount = line.retencion_percentage
    ? roundToTwo(taxableBase * (line.retencion_percentage / 100))
    : 0;
  const total = roundToTwo(taxableBase + taxAmount + recargoAmount - retencionAmount);

  return {
    subtotal: taxableBase,
    discount_amount: discountAmount,
    tax_amount: taxAmount,
    recargo_amount: recargoAmount,
    retencion_amount: retencionAmount,
    total,
  };
}

function roundToTwo(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class InvoicesService {
  /**
   * Obtener todas las facturas emitidas de un centro.
   */
  static async getIssuedByCentro(centroCode: string): Promise<InvoiceIssued[]> {
    const { data, error } = await supabase
      .from("invoices_issued")
      .select("*")
      .eq("centro_code", centroCode)
      .order("invoice_number", { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Obtener una factura emitida por ID.
   */
  static async getIssuedById(id: string): Promise<InvoiceIssued | null> {
    const { data, error } = await supabase
      .from("invoices_issued")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  /**
   * Crear una factura emitida.
   *
   * La numeración y el hash Verifactu se calculan automáticamente
   * en los triggers de PostgreSQL (auto_invoice_number + compute_verifactu_hash).
   *
   * Ley Antifraude: Una vez creada, la factura NO puede eliminarse.
   * Solo puede corregirse mediante factura rectificativa.
   */
  static async createIssued(input: CreateInvoiceInput): Promise<InvoiceIssued> {
    // Calcular totales a partir de las líneas
    let subtotal = 0;
    let taxTotal = 0;
    let total = 0;

    const processedLines = input.lines.map((line, index) => {
      const calc = calculateLineTotals(line);
      subtotal += calc.subtotal;
      taxTotal += calc.tax_amount + calc.recargo_amount;
      total += calc.total;

      return {
        invoice_type: "issued" as const,
        line_number: index + 1,
        description: line.description,
        quantity: line.quantity,
        unit_price: line.unit_price,
        discount_percentage: line.discount_percentage || null,
        discount_amount: calc.discount_amount || null,
        subtotal: calc.subtotal,
        tax_rate: line.tax_rate,
        tax_amount: calc.tax_amount,
        tax_code_id: line.tax_code_id || null,
        recargo_equivalencia: line.recargo_equivalencia || null,
        retencion_percentage: line.retencion_percentage || null,
        retencion_amount: calc.retencion_amount || null,
        total: calc.total,
        account_code: line.account_code || null,
      };
    });

    subtotal = roundToTwo(subtotal);
    taxTotal = roundToTwo(taxTotal);
    total = roundToTwo(total);

    // Insertar factura (numeración + hash se calculan en triggers)
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices_issued")
      .insert({
        centro_code: input.centro_code,
        invoice_date: input.invoice_date,
        invoice_series: input.invoice_series || "F",
        invoice_number: 0, // Se sobrescribe por trigger auto_invoice_number
        customer_name: input.customer_name,
        customer_tax_id: input.customer_tax_id || null,
        customer_email: input.customer_email || null,
        customer_address: input.customer_address || null,
        due_date: input.due_date || null,
        subtotal,
        tax_total: taxTotal,
        total,
        status: "emitida",
        notes: input.notes || null,
      })
      .select()
      .single();

    if (invoiceError) throw invoiceError;

    // Insertar líneas de factura
    if (processedLines.length > 0) {
      const linesWithInvoiceId = processedLines.map((line) => ({
        ...line,
        invoice_id: invoice.id,
      }));

      const { error: linesError } = await supabase
        .from("invoice_lines")
        .insert(linesWithInvoiceId);

      if (linesError) throw linesError;
    }

    return invoice;
  }

  /**
   * Crear una factura rectificativa (Art. 15 RD 1619/2012).
   *
   * En lugar de borrar o modificar la factura original, se crea una nueva
   * factura rectificativa que referencia la original.
   *
   * La factura original queda marcada con status = 'rectificada'.
   */
  static async createRectificativa(
    input: CreateRectificativaInput
  ): Promise<{ rectificativa: InvoiceIssued; registro: InvoiceRectificativa }> {
    // Obtener la factura original
    const original = await this.getIssuedById(input.original_invoice_id);
    if (!original) {
      throw new Error("Factura original no encontrada");
    }

    if (original.status === "rectificada") {
      throw new Error("Esta factura ya ha sido rectificada");
    }

    // Crear la factura rectificativa con serie "R"
    const rectificativaInvoice = await this.createIssued({
      centro_code: original.centro_code,
      invoice_date: new Date().toISOString().split("T")[0],
      invoice_series: "R", // Serie R para rectificativas
      customer_name: original.customer_name,
      customer_tax_id: original.customer_tax_id || undefined,
      customer_email: original.customer_email || undefined,
      customer_address: original.customer_address || undefined,
      notes: `Rectificativa de ${original.full_invoice_number}. Motivo: ${input.motivo}. ${input.descripcion || ""}`,
      lines: input.lines,
    });

    // Registrar la relación rectificativa
    const { data: registro, error: regError } = await supabase
      .from("invoices_rectificativas")
      .insert({
        original_invoice_id: original.id,
        rectificativa_invoice_id: rectificativaInvoice.id,
        motivo: input.motivo,
        metodo_rectificacion: input.metodo_rectificacion || "sustitucion",
        descripcion: input.descripcion || null,
      })
      .select()
      .single();

    if (regError) throw regError;

    return { rectificativa: rectificativaInvoice, registro };
  }

  /**
   * Obtener las rectificativas de una factura original.
   */
  static async getRectificativas(
    originalInvoiceId: string
  ): Promise<InvoiceRectificativa[]> {
    const { data, error } = await supabase
      .from("invoices_rectificativas")
      .select("*")
      .eq("original_invoice_id", originalInvoiceId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Marcar una factura como pagada.
   * (Campo administrativo, no afecta datos fiscales - permitido por el trigger)
   */
  static async markAsPaid(
    invoiceId: string,
    paymentTransactionId?: string
  ): Promise<void> {
    const { error } = await supabase
      .from("invoices_issued")
      .update({
        status: "pagada",
        paid_at: new Date().toISOString(),
        payment_transaction_id: paymentTransactionId || null,
      })
      .eq("id", invoiceId);

    if (error) throw error;
  }

  /**
   * Marcar una factura como enviada al cliente.
   */
  static async markAsSent(invoiceId: string): Promise<void> {
    const { error } = await supabase
      .from("invoices_issued")
      .update({
        status: "enviada",
        sent_at: new Date().toISOString(),
      })
      .eq("id", invoiceId);

    if (error) throw error;
  }

  /**
   * Obtener el log de eventos Verifactu para una factura.
   */
  static async getVerifactuEvents(invoiceId: string) {
    const { data, error } = await supabase
      .from("verifactu_event_log")
      .select("*")
      .eq("invoice_id", invoiceId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return data || [];
  }

  /**
   * Verificar integridad de la cadena de hashes de un centro.
   * Recalcula todos los hashes secuencialmente y compara.
   */
  static async verifyHashChain(
    centroCode: string
  ): Promise<{ valid: boolean; brokenAt?: string; total: number }> {
    const { data: invoices, error } = await supabase
      .from("invoices_issued")
      .select("id, full_invoice_number, invoice_series, invoice_number, invoice_date, customer_tax_id, subtotal, tax_total, total, verifactu_hash")
      .eq("centro_code", centroCode)
      .not("verifactu_hash", "is", null)
      .order("invoice_number", { ascending: true });

    if (error) throw error;
    if (!invoices || invoices.length === 0) {
      return { valid: true, total: 0 };
    }

    // Necesitamos el NIF del centro para recalcular
    const { data: centre } = await supabase
      .from("centres")
      .select("tax_id")
      .eq("code", centroCode)
      .maybeSingle();

    const issuerTaxId = centre?.tax_id || "";

    // Importar dinámicamente para evitar dependencia circular
    const { computeVerifactuHash } = await import("@/lib/verifactu");

    let previousHash = "";
    for (const inv of invoices) {
      const invoiceData: VerifactuInvoiceData = {
        invoiceSeries: inv.invoice_series || "",
        invoiceNumber: inv.invoice_number,
        invoiceDate: inv.invoice_date,
        issuerTaxId,
        recipientTaxId: inv.customer_tax_id || "",
        subtotal: inv.subtotal || 0,
        taxTotal: inv.tax_total || 0,
        total: inv.total,
      };

      const { hash } = await computeVerifactuHash(invoiceData, previousHash);

      if (hash !== inv.verifactu_hash) {
        return {
          valid: false,
          brokenAt: inv.full_invoice_number || inv.id,
          total: invoices.length,
        };
      }

      previousHash = inv.verifactu_hash;
    }

    return { valid: true, total: invoices.length };
  }
}
