import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface OrquestProxyRequest {
  path: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  query?: Record<string, string>;
  body?: any;
  franchiseeId?: string; // ID del franquiciado para autenticación multi-tenant
}

interface OrquestError {
  error: string;
  status?: number;
  details?: any;
}

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generic Orquest API call through the Edge Function proxy
 * Includes exponential backoff retry logic and error handling
 */
export async function callOrquestAPI<T>(
  request: OrquestProxyRequest,
  retryCount = 0
): Promise<T> {
  try {
    console.log(`Calling Orquest API: ${request.method || 'GET'} ${request.path}`);
    
    const { data, error } = await supabase.functions.invoke('orquest_proxy', {
      body: {
        path: request.path,
        method: request.method,
        query: request.query,
        body: request.body,
        franchiseeId: request.franchiseeId, // Pasar franchiseeId al proxy
      }
    });

    if (error) {
      throw error;
    }

    // Check if response contains an error from Orquest
    if (data && typeof data === 'object' && 'error' in data) {
      const orquestError = data as OrquestError;
      
      // Handle authentication errors
      if (orquestError.status === 401 || orquestError.status === 403) {
        toast.error('Error de autenticación', {
          description: 'Las credenciales de Orquest han expirado. Por favor, contacta con el administrador.'
        });
        throw new Error('Authentication failed with Orquest API');
      }

      // Handle server errors with retry
      if (orquestError.status && orquestError.status >= 500) {
        if (retryCount < MAX_RETRIES) {
          const retryDelay = INITIAL_RETRY_DELAY * Math.pow(2, retryCount);
          console.log(`Orquest API error ${orquestError.status}, retrying in ${retryDelay}ms...`);
          
          toast.warning('Error temporal', {
            description: `Reintentando conexión con Orquest (${retryCount + 1}/${MAX_RETRIES})...`
          });
          
          await delay(retryDelay);
          return callOrquestAPI<T>(request, retryCount + 1);
        } else {
          toast.error('Error del servidor', {
            description: 'No se pudo conectar con Orquest después de varios intentos.'
          });
          throw new Error(`Orquest API error: ${orquestError.error}`);
        }
      }

      // Other errors
      throw new Error(orquestError.error);
    }

    return data as T;

  } catch (error) {
    console.error('Orquest API call failed:', error);
    
    if (retryCount === 0) {
      toast.error('Error de conexión', {
        description: 'No se pudo conectar con Orquest. Por favor, inténtalo de nuevo.'
      });
    }
    
    throw error;
  }
}
