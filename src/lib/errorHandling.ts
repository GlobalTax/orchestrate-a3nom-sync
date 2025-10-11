import { toast } from "sonner";

/**
 * Custom application error class
 */
export class AppError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = "AppError";
  }
}

/**
 * Centralized error handler
 */
export const ErrorHandler = {
  /**
   * Handle any error and show appropriate toast message
   */
  handle(error: unknown, context?: string) {
    const prefix = context ? `[${context}]` : "";
    console.error(`${prefix} Error:`, error);

    if (error instanceof AppError) {
      toast.error(error.message);
      return;
    }

    if (error && typeof error === "object" && "message" in error) {
      const errorMessage = (error as Error).message;
      
      // Handle specific Supabase errors
      if (errorMessage.includes("JWT")) {
        toast.error("Sesión expirada. Por favor, inicia sesión de nuevo.");
        return;
      }
      
      if (errorMessage.includes("violates row-level security")) {
        toast.error("No tienes permisos para realizar esta acción.");
        return;
      }

      if (errorMessage.includes("unique constraint")) {
        toast.error("Ya existe un registro con estos datos.");
        return;
      }

      if (errorMessage.includes("foreign key constraint")) {
        toast.error("No se puede eliminar porque hay registros relacionados.");
        return;
      }

      toast.error(`Error: ${errorMessage}`);
      return;
    }

    toast.error("Ha ocurrido un error inesperado");
  },

  /**
   * Wrap async function with error handling
   */
  async handleAsync<T>(
    fn: () => Promise<T>,
    context: string
  ): Promise<T | null> {
    try {
      return await fn();
    } catch (error) {
      this.handle(error, context);
      return null;
    }
  },

  /**
   * Wrap async function with error handling and custom error message
   */
  async handleAsyncWithMessage<T>(
    fn: () => Promise<T>,
    successMessage: string,
    errorMessage: string
  ): Promise<T | null> {
    try {
      const result = await fn();
      toast.success(successMessage);
      return result;
    } catch (error) {
      console.error(error);
      toast.error(errorMessage);
      return null;
    }
  },

  /**
   * Create an AppError
   */
  createError(message: string, code?: string, details?: any): AppError {
    return new AppError(message, code, details);
  },
};

/**
 * Utility to retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  initialDelay = 1000
): Promise<T> {
  let lastError: any;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (i < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, i);
        console.log(`Retry ${i + 1}/${maxRetries} after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}
