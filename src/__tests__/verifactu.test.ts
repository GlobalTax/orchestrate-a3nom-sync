import { describe, it, expect } from "vitest";
import {
  computeVerifactuHash,
  buildHashInput,
  verifyVerifactuHash,
  generateVerifactuQR,
  validateInvoiceForVerifactu,
  isValidSpanishTaxId,
  calculateNIFLetter,
  MOTIVOS_RECTIFICACION,
  type VerifactuInvoiceData,
} from "@/lib/verifactu";

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const sampleInvoice: VerifactuInvoiceData = {
  invoiceSeries: "F",
  invoiceNumber: 1,
  invoiceDate: "2026-03-27",
  issuerTaxId: "B12345678",
  recipientTaxId: "12345678Z",
  subtotal: 1000,
  taxTotal: 210,
  total: 1210,
};

const sampleInvoice2: VerifactuInvoiceData = {
  invoiceSeries: "F",
  invoiceNumber: 2,
  invoiceDate: "2026-03-28",
  issuerTaxId: "B12345678",
  recipientTaxId: "A87654321",
  subtotal: 500,
  taxTotal: 105,
  total: 605,
};

// ---------------------------------------------------------------------------
// Hash SHA-256 encadenado
// ---------------------------------------------------------------------------

describe("Verifactu Hash Chain (Art. 8 RD 1007/2023)", () => {
  it("computes a deterministic SHA-256 hash", async () => {
    const result1 = await computeVerifactuHash(sampleInvoice);
    const result2 = await computeVerifactuHash(sampleInvoice);
    expect(result1.hash).toBe(result2.hash);
    expect(result1.hash).toHaveLength(64); // SHA-256 hex = 64 chars
  });

  it("includes previous hash in chain", async () => {
    const first = await computeVerifactuHash(sampleInvoice);
    const chained = await computeVerifactuHash(sampleInvoice2, first.hash);
    const unchained = await computeVerifactuHash(sampleInvoice2, "");

    // Chained and unchained should differ
    expect(chained.hash).not.toBe(unchained.hash);
    // Both should be valid SHA-256
    expect(chained.hash).toHaveLength(64);
    expect(unchained.hash).toHaveLength(64);
  });

  it("first invoice in chain uses empty previous hash", async () => {
    const result = await computeVerifactuHash(sampleInvoice, "");
    const result2 = await computeVerifactuHash(sampleInvoice);
    expect(result.hash).toBe(result2.hash);
  });

  it("different data produces different hash", async () => {
    const hash1 = await computeVerifactuHash(sampleInvoice);
    const modified = { ...sampleInvoice, total: 1211 };
    const hash2 = await computeVerifactuHash(modified);
    expect(hash1.hash).not.toBe(hash2.hash);
  });

  it("any field change breaks the hash", async () => {
    const original = await computeVerifactuHash(sampleInvoice);

    // Change each field and verify hash differs
    const fields: (keyof VerifactuInvoiceData)[] = [
      "invoiceSeries", "invoiceNumber", "invoiceDate",
      "issuerTaxId", "recipientTaxId", "subtotal", "taxTotal", "total",
    ];

    for (const field of fields) {
      const modified = { ...sampleInvoice };
      if (typeof modified[field] === "number") {
        (modified as Record<string, unknown>)[field] = (modified[field] as number) + 1;
      } else {
        (modified as Record<string, unknown>)[field] = modified[field] + "X";
      }
      const result = await computeVerifactuHash(modified);
      expect(result.hash).not.toBe(original.hash);
    }
  });
});

describe("buildHashInput", () => {
  it("builds pipe-separated string with correct format", () => {
    const input = buildHashInput(sampleInvoice, "abc123");
    expect(input).toBe("F-1|2026-03-27|B12345678|12345678Z|1000|210|1210|abc123");
  });

  it("handles empty previous hash", () => {
    const input = buildHashInput(sampleInvoice);
    expect(input).toBe("F-1|2026-03-27|B12345678|12345678Z|1000|210|1210|");
  });

  it("handles missing recipient tax id", () => {
    const noRecipient = { ...sampleInvoice, recipientTaxId: "" };
    const input = buildHashInput(noRecipient);
    expect(input).toContain("||"); // Empty recipient between pipes
  });
});

describe("verifyVerifactuHash", () => {
  it("returns true for matching hash", async () => {
    const { hash } = await computeVerifactuHash(sampleInvoice);
    const result = await verifyVerifactuHash(sampleInvoice, hash);
    expect(result).toBe(true);
  });

  it("returns false for tampered hash", async () => {
    const result = await verifyVerifactuHash(sampleInvoice, "tampered_hash_value");
    expect(result).toBe(false);
  });

  it("returns false for tampered data", async () => {
    const { hash } = await computeVerifactuHash(sampleInvoice);
    const tampered = { ...sampleInvoice, total: 9999 };
    const result = await verifyVerifactuHash(tampered, hash);
    expect(result).toBe(false);
  });

  it("verifies chained hashes correctly", async () => {
    const first = await computeVerifactuHash(sampleInvoice);
    const second = await computeVerifactuHash(sampleInvoice2, first.hash);

    const valid = await verifyVerifactuHash(sampleInvoice2, second.hash, first.hash);
    expect(valid).toBe(true);

    // Wrong previous hash should fail
    const invalid = await verifyVerifactuHash(sampleInvoice2, second.hash, "wrong");
    expect(invalid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// QR de verificación (Art. 13 RD 1007/2023)
// ---------------------------------------------------------------------------

describe("Verifactu QR Generation (Art. 13 RD 1007/2023)", () => {
  it("generates AEAT verification URL", () => {
    const qr = generateVerifactuQR("B12345678", "F-2026-000001", "2026-03-27", 1210);
    expect(qr.url).toContain("ValidarQR");
    expect(qr.url).toContain("nif=B12345678");
    expect(qr.url).toContain("numserie=F-2026-000001");
    expect(qr.url).toContain("importe=1210.00");
  });

  it("formats date as DD-MM-YYYY for AEAT", () => {
    const qr = generateVerifactuQR("B12345678", "F-001", "2026-03-27", 100);
    expect(qr.url).toContain("fecha=27-03-2026");
  });

  it("formats total with 2 decimals", () => {
    const qr = generateVerifactuQR("B12345678", "F-001", "2026-01-01", 100.5);
    expect(qr.url).toContain("importe=100.50");
  });

  it("returns payload as URL params string", () => {
    const qr = generateVerifactuQR("B12345678", "F-001", "2026-01-01", 100);
    expect(qr.payload).toContain("nif=B12345678");
    expect(qr.payload).toContain("numserie=F-001");
  });
});

// ---------------------------------------------------------------------------
// Validaciones fiscales
// ---------------------------------------------------------------------------

describe("Invoice Validation (Art. 6 RD 1619/2012)", () => {
  it("valid invoice returns no errors", () => {
    const errors = validateInvoiceForVerifactu(sampleInvoice);
    expect(errors).toHaveLength(0);
  });

  it("detects missing required fields", () => {
    const errors = validateInvoiceForVerifactu({});
    const fields = errors.map((e) => e.field);
    expect(fields).toContain("invoiceSeries");
    expect(fields).toContain("invoiceNumber");
    expect(fields).toContain("invoiceDate");
    expect(fields).toContain("issuerTaxId");
    expect(fields).toContain("total");
  });

  it("validates issuer tax ID format", () => {
    const errors = validateInvoiceForVerifactu({
      ...sampleInvoice,
      issuerTaxId: "INVALID",
    });
    expect(errors.some((e) => e.field === "issuerTaxId")).toBe(true);
  });

  it("validates recipient tax ID if provided", () => {
    const errors = validateInvoiceForVerifactu({
      ...sampleInvoice,
      recipientTaxId: "INVALID",
    });
    expect(errors.some((e) => e.field === "recipientTaxId")).toBe(true);
  });

  it("skips recipient validation when empty", () => {
    const errors = validateInvoiceForVerifactu({
      ...sampleInvoice,
      recipientTaxId: "",
    });
    expect(errors.some((e) => e.field === "recipientTaxId")).toBe(false);
  });

  it("validates date format", () => {
    const errors = validateInvoiceForVerifactu({
      ...sampleInvoice,
      invoiceDate: "27/03/2026",
    });
    expect(errors.some((e) => e.field === "invoiceDate")).toBe(true);
  });

  it("detects total mismatch with base + cuota", () => {
    const errors = validateInvoiceForVerifactu({
      ...sampleInvoice,
      subtotal: 1000,
      taxTotal: 210,
      total: 1500, // Should be 1210
    });
    expect(errors.some((e) => e.field === "total")).toBe(true);
  });

  it("accepts correct total matching base + cuota", () => {
    const errors = validateInvoiceForVerifactu({
      ...sampleInvoice,
      subtotal: 1000,
      taxTotal: 210,
      total: 1210,
    });
    expect(errors.some((e) => e.field === "total" && e.message.includes("no coincide"))).toBe(false);
  });

  it("detects negative total", () => {
    const errors = validateInvoiceForVerifactu({
      ...sampleInvoice,
      total: -100,
    });
    expect(errors.some((e) => e.field === "total" && e.message.includes("negativo"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// NIF/CIF/NIE validation
// ---------------------------------------------------------------------------

describe("Spanish Tax ID Validation", () => {
  describe("NIF (persona física)", () => {
    it("accepts valid NIF", () => {
      expect(isValidSpanishTaxId("12345678Z")).toBe(true);
      expect(isValidSpanishTaxId("00000000T")).toBe(true);
    });

    it("rejects NIF with wrong length", () => {
      expect(isValidSpanishTaxId("1234567Z")).toBe(false);
      expect(isValidSpanishTaxId("123456789ZZ")).toBe(false);
    });

    it("rejects NIF without letter", () => {
      expect(isValidSpanishTaxId("123456789")).toBe(false);
    });
  });

  describe("CIF (empresa)", () => {
    it("accepts valid CIF", () => {
      expect(isValidSpanishTaxId("B12345678")).toBe(true);
      expect(isValidSpanishTaxId("A87654321")).toBe(true);
      expect(isValidSpanishTaxId("H12345678")).toBe(true);
    });

    it("rejects CIF with invalid first letter", () => {
      expect(isValidSpanishTaxId("I12345678")).toBe(false);
      expect(isValidSpanishTaxId("O12345678")).toBe(false);
    });
  });

  describe("NIE (extranjero)", () => {
    it("accepts valid NIE", () => {
      expect(isValidSpanishTaxId("X1234567A")).toBe(true);
      expect(isValidSpanishTaxId("Y1234567B")).toBe(true);
      expect(isValidSpanishTaxId("Z1234567C")).toBe(true);
    });

    it("rejects NIE with wrong prefix", () => {
      // "W" is a valid CIF prefix, so use a letter that's invalid for all formats
      expect(isValidSpanishTaxId("Ñ1234567A")).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("rejects empty string", () => {
      expect(isValidSpanishTaxId("")).toBe(false);
    });

    it("rejects null/undefined", () => {
      expect(isValidSpanishTaxId(null as unknown as string)).toBe(false);
      expect(isValidSpanishTaxId(undefined as unknown as string)).toBe(false);
    });

    it("handles spaces and dashes", () => {
      expect(isValidSpanishTaxId("B-1234567-8")).toBe(false); // too long after cleanup? No: B12345678 = 9 chars
    });

    it("is case insensitive", () => {
      expect(isValidSpanishTaxId("b12345678")).toBe(true);
      expect(isValidSpanishTaxId("x1234567a")).toBe(true);
    });
  });
});

describe("calculateNIFLetter", () => {
  it("calculates correct letter for known DNI numbers", () => {
    // Known: 12345678 → Z
    expect(calculateNIFLetter(12345678)).toBe("Z");
    // Known: 0 → T
    expect(calculateNIFLetter(0)).toBe("T");
    // Known: 1 → R
    expect(calculateNIFLetter(1)).toBe("R");
  });

  it("always returns a single uppercase letter", () => {
    for (let i = 0; i < 23; i++) {
      const letter = calculateNIFLetter(i);
      expect(letter).toMatch(/^[A-Z]$/);
    }
  });

  it("cycles through 23 letters", () => {
    const letters = new Set<string>();
    for (let i = 0; i < 23; i++) {
      letters.add(calculateNIFLetter(i));
    }
    expect(letters.size).toBe(23);
    // 23rd wraps around
    expect(calculateNIFLetter(23)).toBe(calculateNIFLetter(0));
  });
});

// ---------------------------------------------------------------------------
// Motivos de rectificación (Art. 15 RD 1619/2012)
// ---------------------------------------------------------------------------

describe("Motivos de Rectificación", () => {
  it("defines all required motivos", () => {
    expect(Object.keys(MOTIVOS_RECTIFICACION)).toHaveLength(7);
    expect(MOTIVOS_RECTIFICACION.error_datos_obligatorios).toContain("Art. 15.1.a");
    expect(MOTIVOS_RECTIFICACION.creditos_incobrables).toContain("Art. 80.4 LIVA");
  });

  it("each motivo has a descriptive string", () => {
    for (const [key, value] of Object.entries(MOTIVOS_RECTIFICACION)) {
      expect(typeof value).toBe("string");
      expect(value.length).toBeGreaterThan(10);
    }
  });
});

// ---------------------------------------------------------------------------
// Hash chain integrity simulation
// ---------------------------------------------------------------------------

describe("Hash Chain Integrity", () => {
  it("simulates a chain of 5 invoices", async () => {
    const invoices: VerifactuInvoiceData[] = Array.from({ length: 5 }, (_, i) => ({
      invoiceSeries: "F",
      invoiceNumber: i + 1,
      invoiceDate: `2026-03-${String(i + 1).padStart(2, "0")}`,
      issuerTaxId: "B12345678",
      recipientTaxId: `A${String(10000000 + i)}`,
      subtotal: (i + 1) * 100,
      taxTotal: (i + 1) * 21,
      total: (i + 1) * 121,
    }));

    const hashes: string[] = [];
    for (let i = 0; i < invoices.length; i++) {
      const prevHash = i > 0 ? hashes[i - 1] : "";
      const { hash } = await computeVerifactuHash(invoices[i], prevHash);
      hashes.push(hash);
    }

    // All hashes should be unique
    expect(new Set(hashes).size).toBe(5);

    // Verify each hash in the chain
    for (let i = 0; i < invoices.length; i++) {
      const prevHash = i > 0 ? hashes[i - 1] : "";
      const valid = await verifyVerifactuHash(invoices[i], hashes[i], prevHash);
      expect(valid).toBe(true);
    }
  });

  it("detects tampering in the middle of the chain", async () => {
    const invoices: VerifactuInvoiceData[] = Array.from({ length: 3 }, (_, i) => ({
      invoiceSeries: "F",
      invoiceNumber: i + 1,
      invoiceDate: `2026-01-${String(i + 1).padStart(2, "0")}`,
      issuerTaxId: "B12345678",
      recipientTaxId: "A87654321",
      subtotal: 100,
      taxTotal: 21,
      total: 121,
    }));

    // Build the chain
    const hashes: string[] = [];
    for (let i = 0; i < invoices.length; i++) {
      const prevHash = i > 0 ? hashes[i - 1] : "";
      const { hash } = await computeVerifactuHash(invoices[i], prevHash);
      hashes.push(hash);
    }

    // Tamper with invoice 2's total
    invoices[1] = { ...invoices[1], total: 999 };

    // Re-verify: invoice 2 should fail
    const valid = await verifyVerifactuHash(invoices[1], hashes[1], hashes[0]);
    expect(valid).toBe(false);

    // Invoice 3 would also fail if we tried to verify with the original chain
    // because its previous hash (hashes[1]) was computed from the original invoice 2
  });
});
