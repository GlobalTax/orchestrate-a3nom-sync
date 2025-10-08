import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface OrquestProxyRequest {
  path: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  query?: Record<string, string>;
  body?: any;
}

interface OrquestError {
  error: string;
  status?: number;
  details?: any;
}

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second

/**
 * Exponential backoff retry logic
 */
async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generic Orquest API call through the Edge Function proxy
 */
async function callOrquestAPI<T>(
  request: OrquestProxyRequest,
  retryCount = 0
): Promise<T> {
  try {
    console.log(`Calling Orquest API: ${request.method || 'GET'} ${request.path}`);
    
    const { data, error } = await supabase.functions.invoke('orquest_proxy', {
      body: request
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

/**
 * Get employees by service from Orquest
 */
export async function getEmployeesByService(serviceId: string) {
  return callOrquestAPI({
    path: `/api/employees/service/${serviceId}`,
    method: 'GET'
  });
}

/**
 * Get all employees from Orquest
 */
export async function getAllEmployees() {
  return callOrquestAPI({
    path: '/api/employees',
    method: 'GET'
  });
}

/**
 * Get assignments (schedules) from Orquest
 */
export async function getAssignments(params: {
  startDate: string;
  endDate: string;
  serviceId?: string;
  employeeId?: string;
}) {
  const query: Record<string, string> = {
    startDate: params.startDate,
    endDate: params.endDate,
  };

  if (params.serviceId) query.serviceId = params.serviceId;
  if (params.employeeId) query.employeeId = params.employeeId;

  return callOrquestAPI({
    path: '/api/assignments',
    method: 'GET',
    query
  });
}

/**
 * Get absences from Orquest
 */
export async function getAbsences(params: {
  startDate: string;
  endDate: string;
  employeeId?: string;
}) {
  const query: Record<string, string> = {
    startDate: params.startDate,
    endDate: params.endDate,
  };

  if (params.employeeId) query.employeeId = params.employeeId;

  return callOrquestAPI({
    path: '/api/absences',
    method: 'GET',
    query
  });
}

/**
 * Get services from Orquest (real-time)
 */
export async function getServices() {
  return callOrquestAPI({
    path: '/api/services',
    method: 'GET'
  });
}

/**
 * Get services from Supabase cache (hybrid approach)
 * Falls back to Orquest API if cache is empty or stale
 */
export async function getServicesHybrid() {
  const CACHE_VALIDITY_HOURS = 6;
  
  try {
    // First, try to get from Supabase cache
    const { data: cachedServices, error } = await supabase
      .from('orquest_services')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      console.warn('Error al leer caché de servicios:', error);
      // Fall back to real-time API
      return getServices();
    }

    // Check if cache is fresh (updated within last 6 hours)
    if (cachedServices && cachedServices.length > 0) {
      const lastUpdate = new Date(cachedServices[0].updated_at);
      const hoursSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60);

      if (hoursSinceUpdate < CACHE_VALIDITY_HOURS) {
        console.log(`✅ Usando caché de servicios (actualizado hace ${Math.round(hoursSinceUpdate)} horas)`);
        // Transform to match Orquest API format
        return cachedServices.map(service => ({
          id: service.id,
          name: service.nombre,
          timeZone: service.zona_horaria,
          lat: service.latitud,
          lon: service.longitud,
          ...(typeof service.datos_completos === 'object' && service.datos_completos !== null ? service.datos_completos as Record<string, any> : {})
        }));
      }
    }

    console.log('⚠️ Caché vacío o desactualizado, consultando Orquest API...');
    // Cache is stale or empty, fetch from API and update cache
    const freshServices = await getServices() as any[];
    
    // Update cache in background (no await)
    updateServicesCache(freshServices).catch(err => 
      console.error('Error actualizando caché:', err)
    );

    return freshServices;
  } catch (error) {
    console.error('Error en getServicesHybrid:', error);
    // Last resort: try real-time API
    return getServices();
  }
}

/**
 * Update services cache in Supabase
 * Can be called manually or triggered automatically
 */
export async function updateServicesCache(services?: any[]) {
  try {
    // If services not provided, fetch from Orquest
    const servicesToCache = services || (await getServices() as any[]);

    const servicesToUpsert = servicesToCache.map((service: any) => ({
      id: service.id,
      nombre: service.name,
      zona_horaria: service.timeZone || null,
      latitud: service.lat || null,
      longitud: service.lon || null,
      datos_completos: service,
      updated_at: new Date().toISOString()
    }));

    const { error } = await supabase
      .from('orquest_services')
      .upsert(servicesToUpsert, { onConflict: 'id' });

    if (error) {
      throw error;
    }

    console.log(`✅ Caché actualizado: ${servicesToUpsert.length} servicios`);
    return { success: true, count: servicesToUpsert.length };
  } catch (error) {
    console.error('Error al actualizar caché de servicios:', error);
    throw error;
  }
}

/**
 * Create or update an assignment in Orquest
 */
export async function saveAssignment(assignment: {
  employeeId: string;
  serviceId: string;
  date: string;
  startTime: string;
  endTime: string;
  hours: number;
}) {
  return callOrquestAPI({
    path: '/api/assignments',
    method: 'POST',
    body: assignment
  });
}

/**
 * Delete an assignment from Orquest
 */
export async function deleteAssignment(assignmentId: string) {
  return callOrquestAPI({
    path: `/api/assignments/${assignmentId}`,
    method: 'DELETE'
  });
}
