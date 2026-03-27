import { callOrquestAPI } from "./base";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

/**
 * Get services from Orquest (real-time)
 * @param franchiseeId - (Opcional) ID del franquiciado para usar su API Key
 */
export async function getServices(franchiseeId?: string) {
  return callOrquestAPI({
    path: '/api/services',
    method: 'GET',
    franchiseeId,
  });
}

/**
 * Get services from Supabase cache (hybrid approach)
 * Falls back to Orquest API if cache is empty or stale
 * @param franchiseeId - (Opcional) ID del franquiciado para usar su API Key
 */
export async function getServicesHybrid(franchiseeId?: string) {
  const CACHE_VALIDITY_HOURS = 6;
  
  try {
    // First, try to get from Supabase cache
    const { data: cachedServices, error } = await supabase
      .from('servicios_orquest')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      logger.warn("OrquestServices", "Error al leer caché de servicios:", error);
      // Fall back to real-time API
      return getServices(franchiseeId);
    }

    // Check if cache is fresh (updated within last 6 hours)
    if (cachedServices && cachedServices.length > 0) {
      const lastUpdate = new Date(cachedServices[0].updated_at);
      const hoursSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60);

      if (hoursSinceUpdate < CACHE_VALIDITY_HOURS) {
        logger.info("OrquestServices", `Usando caché de servicios (actualizado hace ${Math.round(hoursSinceUpdate)} horas)`);
        // Transform to match Orquest API format
        return cachedServices.map(service => ({
          id: service.id,
          name: service.nombre,
          timeZone: service.zona_horaria,
          lat: service.latitud,
          lon: service.longitud,
          ...(typeof service.datos_completos === 'object' && service.datos_completos !== null ? service.datos_completos as Record<string, unknown> : {})
        }));
      }
    }

    logger.info("OrquestServices", "Caché vacío o desactualizado, consultando Orquest API...");
    // Cache is stale or empty, fetch from API and update cache
    const freshServices = await getServices(franchiseeId) as Record<string, unknown>[];
    
    // Update cache in background (no await)
    updateServicesCache(freshServices).catch(err => 
      logger.error("OrquestServices", "Error actualizando caché:", err)
    );

    return freshServices;
  } catch (error) {
    logger.error("OrquestServices", "Error en getServicesHybrid:", error);
    // Last resort: try real-time API
    return getServices(franchiseeId);
  }
}

/**
 * Update services cache in Supabase
 * Can be called manually or triggered automatically
 */
export async function updateServicesCache(services?: Record<string, unknown>[]) {
  try {
    // If services not provided, fetch from Orquest
    const servicesToCache = services || (await getServices() as Record<string, unknown>[]);

    const servicesToUpsert = servicesToCache.map((service) => ({
      id: service.id,
      nombre: service.name,
      zona_horaria: service.timeZone || null,
      latitud: service.lat || null,
      longitud: service.lon || null,
      datos_completos: service,
      updated_at: new Date().toISOString()
    }));

    const { error } = await supabase
      .from('servicios_orquest')
      .upsert(servicesToUpsert, { onConflict: 'id' });

    if (error) {
      throw error;
    }

    logger.info("OrquestServices", `Caché actualizado: ${servicesToUpsert.length} servicios`);
    return { success: true, count: servicesToUpsert.length };
  } catch (error) {
    logger.error("OrquestServices", "Error al actualizar caché de servicios:", error);
    throw error;
  }
}
