/**
 * Sanitize a string to prevent XSS when used in HTML contexts.
 * Escapes <, >, &, ", and ' characters.
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/**
 * Trim and sanitize form input. Returns empty string for nullish values.
 */
export function sanitizeInput(value: unknown): string {
  if (value === null || value === undefined) return "";
  return sanitizeString(String(value).trim());
}

/**
 * Sanitize all string fields in a record.
 */
export function sanitizeRecord<T extends Record<string, unknown>>(record: T): T {
  const sanitized = { ...record };
  for (const key in sanitized) {
    if (typeof sanitized[key] === "string") {
      (sanitized as Record<string, unknown>)[key] = sanitizeInput(sanitized[key]);
    }
  }
  return sanitized;
}
