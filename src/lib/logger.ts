const isDev = import.meta.env.DEV;

type LogLevel = "debug" | "info" | "warn" | "error";

function formatMessage(level: LogLevel, context: string, message: string): string {
  return `[${level.toUpperCase()}] [${context}] ${message}`;
}

export const logger = {
  debug(context: string, message: string, ...data: unknown[]) {
    if (isDev) {
      console.debug(formatMessage("debug", context, message), ...data);
    }
  },

  info(context: string, message: string, ...data: unknown[]) {
    if (isDev) {
      console.info(formatMessage("info", context, message), ...data);
    }
  },

  warn(context: string, message: string, ...data: unknown[]) {
    if (isDev) {
      console.warn(formatMessage("warn", context, message), ...data);
    }
  },

  error(context: string, message: string, ...data: unknown[]) {
    // Always log errors, even in production
    console.error(formatMessage("error", context, message), ...data);
  },
};
