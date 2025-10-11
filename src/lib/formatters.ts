import moment from "moment";

/**
 * Utility functions for formatting data
 */

export const Formatters = {
  /**
   * Format date to localized string
   */
  formatDate(date: Date | string | null | undefined, format = "DD/MM/YYYY"): string {
    if (!date) return "-";
    return moment(date).format(format);
  },

  /**
   * Format date to relative time (e.g., "hace 2 días")
   */
  formatRelativeTime(date: Date | string | null | undefined): string {
    if (!date) return "-";
    return moment(date).locale("es").fromNow();
  },

  /**
   * Format number with thousands separator
   */
  formatNumber(num: number | null | undefined, decimals = 0): string {
    if (num === null || num === undefined) return "-";
    return new Intl.NumberFormat("es-ES", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(num);
  },

  /**
   * Format hours (e.g., 8.5 => "8h 30m")
   */
  formatHours(hours: number | null | undefined): string {
    if (hours === null || hours === undefined || hours === 0) return "0h";
    
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  },

  /**
   * Format email (truncate if too long)
   */
  formatEmail(email: string | null | undefined, maxLength = 30): string {
    if (!email) return "-";
    if (email.length <= maxLength) return email;
    return email.substring(0, maxLength - 3) + "...";
  },

  /**
   * Format phone number
   */
  formatPhone(phone: string | null | undefined): string {
    if (!phone) return "-";
    // Remove all non-numeric characters
    const cleaned = phone.replace(/\D/g, "");
    // Format as Spanish phone: +34 XXX XXX XXX
    if (cleaned.length === 9) {
      return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
    }
    return phone;
  },

  /**
   * Format boolean as Sí/No
   */
  formatBoolean(value: boolean | null | undefined): string {
    if (value === null || value === undefined) return "-";
    return value ? "Sí" : "No";
  },

  /**
   * Truncate string with ellipsis
   */
  truncate(str: string | null | undefined, maxLength = 50): string {
    if (!str) return "-";
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + "...";
  },

  /**
   * Format full name from first and last names
   */
  formatFullName(firstName: string | null | undefined, lastName: string | null | undefined): string {
    const parts = [firstName, lastName].filter(Boolean);
    return parts.length > 0 ? parts.join(" ") : "-";
  },

  /**
   * Format initials from name
   */
  formatInitials(firstName: string | null | undefined, lastName: string | null | undefined): string {
    const f = firstName?.charAt(0).toUpperCase() || "";
    const l = lastName?.charAt(0).toUpperCase() || "";
    return f + l || "?";
  },

  /**
   * Format file size in human readable format
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  },
};
