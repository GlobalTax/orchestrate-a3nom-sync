import { callOrquestAPI } from "./base";
import { supabase } from "@/integrations/supabase/client";

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
