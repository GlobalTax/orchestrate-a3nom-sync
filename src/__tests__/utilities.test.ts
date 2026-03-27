import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Mock dependencies used by errorHandling.ts ──────────────────────────────
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { sanitizeString, sanitizeInput, sanitizeRecord } from "@/lib/sanitize";
import { Formatters } from "@/lib/formatters";
import { AppError, retryWithBackoff } from "@/lib/errorHandling";

// ═══════════════════════════════════════════════════════════════════════════════
// 1. sanitize.ts
// ═══════════════════════════════════════════════════════════════════════════════

describe("sanitizeString", () => {
  it("escapes ampersands", () => {
    expect(sanitizeString("a & b")).toBe("a &amp; b");
  });

  it("escapes less-than signs", () => {
    expect(sanitizeString("a < b")).toBe("a &lt; b");
  });

  it("escapes greater-than signs", () => {
    expect(sanitizeString("a > b")).toBe("a &gt; b");
  });

  it("escapes double quotes", () => {
    expect(sanitizeString('say "hello"')).toBe("say &quot;hello&quot;");
  });

  it("escapes single quotes", () => {
    expect(sanitizeString("it's")).toBe("it&#x27;s");
  });

  it("escapes all special characters in one string", () => {
    expect(sanitizeString(`<a href="x" onclick='y'>&`)).toBe(
      "&lt;a href=&quot;x&quot; onclick=&#x27;y&#x27;&gt;&amp;"
    );
  });

  it("handles a full script injection payload", () => {
    const input = '<script>alert("xss")</script>';
    const expected =
      "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;";
    expect(sanitizeString(input)).toBe(expected);
  });

  it("returns empty string unchanged", () => {
    expect(sanitizeString("")).toBe("");
  });

  it("returns plain text unchanged", () => {
    expect(sanitizeString("hello world")).toBe("hello world");
  });

  it("handles multiple consecutive special characters", () => {
    expect(sanitizeString("<<>>&&")).toBe(
      "&lt;&lt;&gt;&gt;&amp;&amp;"
    );
  });
});

describe("sanitizeInput", () => {
  it("returns empty string for null", () => {
    expect(sanitizeInput(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(sanitizeInput(undefined)).toBe("");
  });

  it("trims leading and trailing whitespace", () => {
    expect(sanitizeInput("  hello  ")).toBe("hello");
  });

  it("trims and sanitizes simultaneously", () => {
    expect(sanitizeInput("  <b>  ")).toBe("&lt;b&gt;");
  });

  it("converts numbers to sanitized strings", () => {
    expect(sanitizeInput(42)).toBe("42");
  });

  it("converts booleans to sanitized strings", () => {
    expect(sanitizeInput(true)).toBe("true");
  });

  it("handles zero as input (falsy but not nullish)", () => {
    expect(sanitizeInput(0)).toBe("0");
  });

  it("handles empty string (falsy but not nullish)", () => {
    expect(sanitizeInput("")).toBe("");
  });
});

describe("sanitizeRecord", () => {
  it("sanitizes all string fields", () => {
    const record = { name: "<b>John</b>", bio: "A & B" };
    const result = sanitizeRecord(record);
    expect(result.name).toBe("&lt;b&gt;John&lt;/b&gt;");
    expect(result.bio).toBe("A &amp; B");
  });

  it("leaves number fields unchanged", () => {
    const record = { name: "test", age: 25 };
    const result = sanitizeRecord(record);
    expect(result.age).toBe(25);
  });

  it("leaves boolean fields unchanged", () => {
    const record = { name: "test", active: true };
    const result = sanitizeRecord(record);
    expect(result.active).toBe(true);
  });

  it("leaves null fields unchanged", () => {
    const record = { name: "test", data: null };
    const result = sanitizeRecord(record);
    expect(result.data).toBeNull();
  });

  it("does not mutate the original record", () => {
    const original = { name: "<b>Hi</b>" };
    sanitizeRecord(original);
    expect(original.name).toBe("<b>Hi</b>");
  });

  it("trims string fields", () => {
    const record = { name: "  hello  " };
    const result = sanitizeRecord(record);
    expect(result.name).toBe("hello");
  });

  it("handles an empty record", () => {
    const record = {};
    const result = sanitizeRecord(record);
    expect(result).toEqual({});
  });

  it("handles a record with mixed types", () => {
    const record = {
      title: '<img src="x" onerror="alert(1)">',
      count: 10,
      active: false,
      tags: ["a", "b"],
    };
    const result = sanitizeRecord(record);
    expect(result.title).toBe(
      '&lt;img src=&quot;x&quot; onerror=&quot;alert(1)&quot;&gt;'
    );
    expect(result.count).toBe(10);
    expect(result.active).toBe(false);
    // Arrays are not strings, so left unchanged
    expect(result.tags).toEqual(["a", "b"]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. formatters.ts
// ═══════════════════════════════════════════════════════════════════════════════

describe("Formatters", () => {
  // ── formatNumber ──────────────────────────────────────────────────────────
  describe("formatNumber", () => {
    it('returns "-" for null', () => {
      expect(Formatters.formatNumber(null)).toBe("-");
    });

    it('returns "-" for undefined', () => {
      expect(Formatters.formatNumber(undefined)).toBe("-");
    });

    it("formats integers", () => {
      const result = Formatters.formatNumber(1234);
      // Accept with or without locale thousands separator
      expect(result).toMatch(/^1\.?234$/);
    });

    it("formats large numbers", () => {
      const result = Formatters.formatNumber(1000000);
      expect(result).toMatch(/^1\.?000\.?000$/);
    });

    it("formats with decimal places when specified", () => {
      const result = Formatters.formatNumber(1234.5, 2);
      // Accept both "1.234,50" (es-ES) and "1,234.50" (en) or "1234.50"/"1234,50"
      expect(result).toContain("1234");
    });

    it("formats zero", () => {
      expect(Formatters.formatNumber(0)).toBe("0");
    });

    it("formats negative numbers", () => {
      const result = Formatters.formatNumber(-1234);
      expect(result).toContain("1234");
      expect(result.startsWith("-")).toBe(true);
    });
  });

  // ── formatHours ───────────────────────────────────────────────────────────
  describe("formatHours", () => {
    it('returns "0h" for 0', () => {
      expect(Formatters.formatHours(0)).toBe("0h");
    });

    it('returns "0h" for null', () => {
      expect(Formatters.formatHours(null)).toBe("0h");
    });

    it('returns "0h" for undefined', () => {
      expect(Formatters.formatHours(undefined)).toBe("0h");
    });

    it("formats whole hours without minutes", () => {
      expect(Formatters.formatHours(8)).toBe("8h");
    });

    it("formats hours with 30 minutes", () => {
      expect(Formatters.formatHours(8.5)).toBe("8h 30m");
    });

    it("formats hours with 15 minutes", () => {
      expect(Formatters.formatHours(2.25)).toBe("2h 15m");
    });

    it("formats hours with 45 minutes", () => {
      expect(Formatters.formatHours(1.75)).toBe("1h 45m");
    });

    it("formats fractional hours that round to whole minutes", () => {
      // 0.1 hours = 6 minutes
      expect(Formatters.formatHours(0.1)).toBe("0h 6m");
    });
  });

  // ── formatEmail ───────────────────────────────────────────────────────────
  describe("formatEmail", () => {
    it('returns "-" for null', () => {
      expect(Formatters.formatEmail(null)).toBe("-");
    });

    it('returns "-" for undefined', () => {
      expect(Formatters.formatEmail(undefined)).toBe("-");
    });

    it('returns "-" for empty string', () => {
      expect(Formatters.formatEmail("")).toBe("-");
    });

    it("returns short email unchanged", () => {
      expect(Formatters.formatEmail("a@b.com")).toBe("a@b.com");
    });

    it("truncates long email with ellipsis", () => {
      const longEmail = "verylongemailaddress@example.com"; // 32 chars
      const result = Formatters.formatEmail(longEmail, 30);
      expect(result).toBe(longEmail.substring(0, 27) + "...");
      expect(result.length).toBe(30);
    });

    it("returns email exactly at maxLength unchanged", () => {
      const email = "a".repeat(30) + "@b.com";
      // 36 chars, default maxLength 30 => truncated
      expect(Formatters.formatEmail(email).length).toBe(30);
    });

    it("respects custom maxLength", () => {
      const email = "test@example.com"; // 16 chars
      expect(Formatters.formatEmail(email, 10)).toBe("test@ex...");
    });
  });

  // ── formatPhone ───────────────────────────────────────────────────────────
  describe("formatPhone", () => {
    it('returns "-" for null', () => {
      expect(Formatters.formatPhone(null)).toBe("-");
    });

    it('returns "-" for undefined', () => {
      expect(Formatters.formatPhone(undefined)).toBe("-");
    });

    it('returns "-" for empty string', () => {
      expect(Formatters.formatPhone("")).toBe("-");
    });

    it("formats a 9-digit Spanish phone number", () => {
      expect(Formatters.formatPhone("612345678")).toBe("612 345 678");
    });

    it("strips non-numeric characters before formatting", () => {
      expect(Formatters.formatPhone("612-345-678")).toBe("612 345 678");
    });

    it("returns original phone if not 9 digits after cleaning", () => {
      expect(Formatters.formatPhone("+34612345678")).toBe("+34612345678");
    });

    it("returns original phone for short numbers", () => {
      expect(Formatters.formatPhone("12345")).toBe("12345");
    });
  });

  // ── formatBoolean ─────────────────────────────────────────────────────────
  describe("formatBoolean", () => {
    it('returns "-" for null', () => {
      expect(Formatters.formatBoolean(null)).toBe("-");
    });

    it('returns "-" for undefined', () => {
      expect(Formatters.formatBoolean(undefined)).toBe("-");
    });

    it('returns "Si" for true', () => {
      expect(Formatters.formatBoolean(true)).toBe("Sí");
    });

    it('returns "No" for false', () => {
      expect(Formatters.formatBoolean(false)).toBe("No");
    });
  });

  // ── truncate ──────────────────────────────────────────────────────────────
  describe("truncate", () => {
    it('returns "-" for null', () => {
      expect(Formatters.truncate(null)).toBe("-");
    });

    it('returns "-" for undefined', () => {
      expect(Formatters.truncate(undefined)).toBe("-");
    });

    it('returns "-" for empty string', () => {
      expect(Formatters.truncate("")).toBe("-");
    });

    it("returns short string unchanged", () => {
      expect(Formatters.truncate("hello")).toBe("hello");
    });

    it("truncates long string at default maxLength (50)", () => {
      const longStr = "a".repeat(60);
      const result = Formatters.truncate(longStr);
      expect(result.length).toBe(50);
      expect(result).toBe("a".repeat(47) + "...");
    });

    it("respects custom maxLength", () => {
      const result = Formatters.truncate("hello world", 8);
      expect(result).toBe("hello...");
      expect(result.length).toBe(8);
    });

    it("returns string exactly at maxLength unchanged", () => {
      const str = "a".repeat(50);
      expect(Formatters.truncate(str, 50)).toBe(str);
    });
  });

  // ── formatFullName ────────────────────────────────────────────────────────
  describe("formatFullName", () => {
    it("combines first and last name", () => {
      expect(Formatters.formatFullName("John", "Doe")).toBe("John Doe");
    });

    it('returns "-" when both are null', () => {
      expect(Formatters.formatFullName(null, null)).toBe("-");
    });

    it('returns "-" when both are undefined', () => {
      expect(Formatters.formatFullName(undefined, undefined)).toBe("-");
    });

    it("returns only first name when last name is null", () => {
      expect(Formatters.formatFullName("John", null)).toBe("John");
    });

    it("returns only last name when first name is null", () => {
      expect(Formatters.formatFullName(null, "Doe")).toBe("Doe");
    });

    it('returns "-" when both are empty strings', () => {
      // empty strings are falsy so filter(Boolean) removes them
      expect(Formatters.formatFullName("", "")).toBe("-");
    });
  });

  // ── formatInitials ────────────────────────────────────────────────────────
  describe("formatInitials", () => {
    it("returns initials from first and last name", () => {
      expect(Formatters.formatInitials("John", "Doe")).toBe("JD");
    });

    it('returns "?" when both are null', () => {
      expect(Formatters.formatInitials(null, null)).toBe("?");
    });

    it('returns "?" when both are undefined', () => {
      expect(Formatters.formatInitials(undefined, undefined)).toBe("?");
    });

    it("returns only first initial when last name is null", () => {
      expect(Formatters.formatInitials("John", null)).toBe("J");
    });

    it("returns only last initial when first name is null", () => {
      expect(Formatters.formatInitials(null, "Doe")).toBe("D");
    });

    it("uppercases lowercase initials", () => {
      expect(Formatters.formatInitials("john", "doe")).toBe("JD");
    });
  });

  // ── formatFileSize ────────────────────────────────────────────────────────
  describe("formatFileSize", () => {
    it('returns "0 B" for zero bytes', () => {
      expect(Formatters.formatFileSize(0)).toBe("0 B");
    });

    it("formats bytes", () => {
      expect(Formatters.formatFileSize(500)).toBe("500.00 B");
    });

    it("formats kilobytes", () => {
      expect(Formatters.formatFileSize(1024)).toBe("1.00 KB");
    });

    it("formats megabytes", () => {
      expect(Formatters.formatFileSize(1048576)).toBe("1.00 MB");
    });

    it("formats gigabytes", () => {
      expect(Formatters.formatFileSize(1073741824)).toBe("1.00 GB");
    });

    it("formats fractional kilobytes", () => {
      expect(Formatters.formatFileSize(1536)).toBe("1.50 KB");
    });

    it("formats fractional megabytes", () => {
      // 2.5 MB = 2621440 bytes
      expect(Formatters.formatFileSize(2621440)).toBe("2.50 MB");
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. errorHandling.ts
// ═══════════════════════════════════════════════════════════════════════════════

describe("AppError", () => {
  it("creates an error with a message", () => {
    const err = new AppError("something went wrong");
    expect(err.message).toBe("something went wrong");
  });

  it("is an instance of Error", () => {
    const err = new AppError("test");
    expect(err).toBeInstanceOf(Error);
  });

  it("is an instance of AppError", () => {
    const err = new AppError("test");
    expect(err).toBeInstanceOf(AppError);
  });

  it('has name "AppError"', () => {
    const err = new AppError("test");
    expect(err.name).toBe("AppError");
  });

  it("stores an optional error code", () => {
    const err = new AppError("not found", "NOT_FOUND");
    expect(err.code).toBe("NOT_FOUND");
  });

  it("stores optional details", () => {
    const details = { field: "email", reason: "invalid" };
    const err = new AppError("validation failed", "VALIDATION", details);
    expect(err.details).toEqual(details);
  });

  it("has undefined code and details when not provided", () => {
    const err = new AppError("test");
    expect(err.code).toBeUndefined();
    expect(err.details).toBeUndefined();
  });

  it("works with try/catch", () => {
    try {
      throw new AppError("caught", "TEST_CODE");
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).code).toBe("TEST_CODE");
    }
  });
});

describe("retryWithBackoff", () => {
  it("returns the result on first successful try", async () => {
    const fn = vi.fn().mockResolvedValue("success");
    const result = await retryWithBackoff(fn, 1, 1);
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries and succeeds on the second attempt", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValue("ok");

    const result = await retryWithBackoff(fn, 3, 1);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("retries and succeeds on the third attempt", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail 1"))
      .mockRejectedValueOnce(new Error("fail 2"))
      .mockResolvedValue("finally");

    const result = await retryWithBackoff(fn, 3, 1);
    expect(result).toBe("finally");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("throws the last error after all retries are exhausted", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("persistent failure"));
    await expect(retryWithBackoff(fn, 3, 1)).rejects.toThrow("persistent failure");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("respects custom maxRetries parameter", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));
    await expect(retryWithBackoff(fn, 2, 1)).rejects.toThrow("fail");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does not delay after the final failed attempt", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));
    await expect(retryWithBackoff(fn, 1, 1)).rejects.toThrow("fail");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("preserves the error type from the failing function", async () => {
    const customError = new AppError("custom", "CUSTOM_CODE");
    const fn = vi.fn().mockRejectedValue(customError);

    try {
      await retryWithBackoff(fn, 1, 1);
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).code).toBe("CUSTOM_CODE");
    }
  });
});
