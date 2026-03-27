import { supabase } from "@/integrations/supabase/client";
import {
  computeVerifactuHash,
  generateVerifactuQR,
  validateInvoiceForVerifactu,
  type VerifactuInvoiceData,
  type VerifactuQRData,
  type InvoiceValidationError,
} from "@/lib/verifactu";
import { logger } from "@/lib/logger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VerifactuSubmissionRecord {
  invoice_id: string;
  full_invoice_number: string;
  hash: string;
  submitted_at: string | null;
  success: boolean;
  error_message: string | null;
}

export interface VerifactuStatusSummary {
  total_invoices: number;
  pending_submission: number;
  submitted_ok: number;
  submission_errors: number;
  hash_chain_valid: boolean;
}

export type VerifactuEventType =
  | "invoice_created"
  | "invoice_rectified"
  | "hash_computed"
  | "aeat_submission_attempt"
  | "aeat_submission_success"
  | "aeat_submission_error"
  | "system_start"
  | "system_error"
  | "config_change";

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class VerifactuService {
  /**
   * Obtener el estado de cumplimiento Verifactu para un centro.
   */
  static async getStatusSummary(centroCode: string): Promise<VerifactuStatusSummary> {
    const { data: invoices, error } = await supabase
      .from("invoices_issued")
      .select("id, verifactu_hash, verifactu_sent_to_aeat")
      .eq("centro_code", centroCode);

    if (error) throw error;

    const all = invoices || [];
    const pending = all.filter((i) => i.verifactu_hash && !i.verifactu_sent_to_aeat);
    const submitted = all.filter((i) => i.verifactu_sent_to_aeat === true);

    // Verificar la cadena de hashes
    const { InvoicesService } = await import("./invoices.service");
    const chainResult = await InvoicesService.verifyHashChain(centroCode);

    return {
      total_invoices: all.length,
      pending_submission: pending.length,
      submitted_ok: submitted.length,
      submission_errors: 0, // Se podría contar desde verifactu_event_log
      hash_chain_valid: chainResult.valid,
    };
  }

  /**
   * Preparar un lote de facturas para envío a AEAT.
   *
   * Retorna las facturas pendientes con sus datos de hash y QR listos.
   * El envío real a la API de la AEAT requiere certificado digital
   * y se implementará como edge function.
   */
  static async prepareBatchForSubmission(
    centroCode: string
  ): Promise<VerifactuSubmissionRecord[]> {
    const { data: invoices, error } = await supabase
      .from("invoices_issued")
      .select("id, full_invoice_number, verifactu_hash, verifactu_sent_to_aeat")
      .eq("centro_code", centroCode)
      .not("verifactu_hash", "is", null)
      .or("verifactu_sent_to_aeat.is.null,verifactu_sent_to_aeat.eq.false")
      .order("invoice_number", { ascending: true });

    if (error) throw error;

    return (invoices || []).map((inv) => ({
      invoice_id: inv.id,
      full_invoice_number: inv.full_invoice_number || "",
      hash: inv.verifactu_hash || "",
      submitted_at: null,
      success: false,
      error_message: null,
    }));
  }

  /**
   * Registrar el resultado de un envío a AEAT.
   * Se llama desde la edge function que hace el envío real.
   */
  static async recordSubmissionResult(
    invoiceId: string,
    success: boolean,
    errorMessage?: string
  ): Promise<void> {
    // Actualizar la factura
    if (success) {
      const { error } = await supabase
        .from("invoices_issued")
        .update({
          verifactu_sent_to_aeat: true,
          verifactu_sent_at: new Date().toISOString(),
        })
        .eq("id", invoiceId);

      if (error) throw error;
    }

    // Registrar el evento
    await this.logEvent(
      success ? "aeat_submission_success" : "aeat_submission_error",
      invoiceId,
      undefined,
      {
        success,
        error_message: errorMessage || null,
        timestamp: new Date().toISOString(),
      }
    );
  }

  /**
   * Generar datos QR de verificación para una factura.
   */
  static async generateQRForInvoice(invoiceId: string): Promise<VerifactuQRData | null> {
    const { data: invoice, error } = await supabase
      .from("invoices_issued")
      .select("full_invoice_number, invoice_date, total, centro_code")
      .eq("id", invoiceId)
      .maybeSingle();

    if (error) throw error;
    if (!invoice) return null;

    // Obtener NIF del centro
    const { data: centre } = await supabase
      .from("centres")
      .select("tax_id")
      .eq("code", invoice.centro_code)
      .maybeSingle();

    if (!centre?.tax_id) {
      logger.warn("VerifactuService", `Centro ${invoice.centro_code} sin NIF configurado`);
      return null;
    }

    return generateVerifactuQR(
      centre.tax_id,
      invoice.full_invoice_number || "",
      invoice.invoice_date,
      invoice.total
    );
  }

  /**
   * Validar una factura antes de emitirla.
   */
  static validateInvoice(data: Partial<VerifactuInvoiceData>): InvoiceValidationError[] {
    return validateInvoiceForVerifactu(data);
  }

  /**
   * Verificar un hash individual de factura contra los datos.
   */
  static async verifyInvoiceHash(invoiceId: string): Promise<boolean> {
    const { data: invoice, error } = await supabase
      .from("invoices_issued")
      .select("*")
      .eq("id", invoiceId)
      .maybeSingle();

    if (error) throw error;
    if (!invoice || !invoice.verifactu_hash) return false;

    // Obtener NIF del centro
    const { data: centre } = await supabase
      .from("centres")
      .select("tax_id")
      .eq("code", invoice.centro_code)
      .maybeSingle();

    // Obtener hash previo
    const { data: prevInvoice } = await supabase
      .from("invoices_issued")
      .select("verifactu_hash")
      .eq("centro_code", invoice.centro_code)
      .lt("invoice_number", invoice.invoice_number)
      .not("verifactu_hash", "is", null)
      .order("invoice_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    const invoiceData: VerifactuInvoiceData = {
      invoiceSeries: invoice.invoice_series || "",
      invoiceNumber: invoice.invoice_number,
      invoiceDate: invoice.invoice_date,
      issuerTaxId: centre?.tax_id || "",
      recipientTaxId: invoice.customer_tax_id || "",
      subtotal: invoice.subtotal || 0,
      taxTotal: invoice.tax_total || 0,
      total: invoice.total,
    };

    const { hash } = await computeVerifactuHash(
      invoiceData,
      prevInvoice?.verifactu_hash || ""
    );

    return hash === invoice.verifactu_hash;
  }

  /**
   * Registrar un evento en el log de Verifactu.
   */
  static async logEvent(
    eventType: VerifactuEventType,
    invoiceId?: string,
    centroCode?: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    const { error } = await supabase.from("verifactu_event_log").insert({
      event_type: eventType,
      invoice_id: invoiceId || null,
      centro_code: centroCode || null,
      details: details || null,
    });

    if (error) {
      logger.error("VerifactuService", "Error registrando evento Verifactu", error);
    }
  }

  /**
   * Obtener el historial de eventos Verifactu filtrado.
   */
  static async getEventLog(
    filters: {
      centroCode?: string;
      eventType?: VerifactuEventType;
      startDate?: string;
      endDate?: string;
    } = {}
  ) {
    let query = supabase
      .from("verifactu_event_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (filters.centroCode) {
      query = query.eq("centro_code", filters.centroCode);
    }
    if (filters.eventType) {
      query = query.eq("event_type", filters.eventType);
    }
    if (filters.startDate) {
      query = query.gte("created_at", filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte("created_at", filters.endDate);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }
}
