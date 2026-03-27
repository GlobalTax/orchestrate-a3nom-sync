import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Configuración mediante secrets
const ORQUEST_API_BASE_URL = Deno.env.get('ORQUEST_BASE_URL') || 'https://pre-mc.orquest.es'
const ORQUEST_BUSINESS_ID = Deno.env.get('ORQUEST_BUSINESS_ID') || 'MCDONALDS_ES'
const ALLOWED_ORIGINS = Deno.env.get('ALLOWED_ORIGINS')?.split(',') || ['*']
const UPSERT_CHUNK_SIZE = parseInt(Deno.env.get('UPSERT_CHUNK_SIZE') || '500')

// Sistema de reintentos con backoff exponencial
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  let lastError: Error | null = null
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options)
      
      // Respetar Retry-After header
      if (response.status === 429 || response.status >= 500) {
        const retryAfter = response.headers.get('Retry-After')
        const delayMs = retryAfter 
          ? parseInt(retryAfter) * 1000 
          : Math.min(1000 * Math.pow(2, attempt), 30000)
        
        console.warn(`⚠️ HTTP ${response.status}, reintentando en ${delayMs}ms (intento ${attempt}/${maxRetries})`)
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, delayMs))
          continue
        }
      }
      
      return response
    } catch (error) {
      lastError = error as Error
      if (attempt < maxRetries) {
        const delayMs = Math.min(1000 * Math.pow(2, attempt), 30000)
        console.warn(`⚠️ Error de red, reintentando en ${delayMs}ms (intento ${attempt}/${maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, delayMs))
      }
    }
  }
  
  throw lastError || new Error('Error desconocido')
}

// Upserts por lotes
async function upsertInChunks(supabase: any, tableName: string, data: any[], chunkSize: number) {
  const chunks = []
  for (let i = 0; i < data.length; i += chunkSize) {
    chunks.push(data.slice(i, i + chunkSize))
  }
  
  let totalUpserted = 0
  for (const [index, chunk] of chunks.entries()) {
    console.log(`  📦 Procesando lote ${index + 1}/${chunks.length} (${chunk.length} registros)`)
    const { error } = await supabase
      .from(tableName)
      .upsert(chunk, { onConflict: 'id' })
    
    if (error) throw error
    totalUpserted += chunk.length
  }
  
  return totalUpserted
}

// CORS restrictivo
function getCorsHeaders(request: Request) {
  const origin = request.headers.get('origin')
  
  if (ALLOWED_ORIGINS.includes('*')) {
    return {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    }
  }
  
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    }
  }
  
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS[0] || '',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
}

interface OrquestService {
  id: string;
  name: string;
  timeZone?: string;
  lat?: number;
  lon?: number;
  [key: string]: any;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Validar origen
  if (!ALLOWED_ORIGINS.includes('*')) {
    const origin = req.headers.get('origin')
    if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
      return new Response('Forbidden', { status: 403 })
    }
  }

  try {
    console.log('🔄 Iniciando sincronización de servicios de Orquest...')
    console.log(`📍 API Base URL: ${ORQUEST_API_BASE_URL}`)
    console.log(`🏢 Business ID: ${ORQUEST_BUSINESS_ID}`)
    console.log(`📦 Chunk size: ${UPSERT_CHUNK_SIZE}`)
    console.log(`🌐 CORS origins: ${ALLOWED_ORIGINS.join(', ')}`)

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Obtener todos los franquiciados con API Key configurada
    const { data: franchisees, error: franchiseesError } = await supabaseClient
      .from('franchisees')
      .select('id, name, email, orquest_api_key, orquest_business_id')
      .not('orquest_api_key', 'is', null)

    if (franchiseesError) throw franchiseesError

    if (!franchisees || franchisees.length === 0) {
      console.error('❌ No hay franquiciados con API Key configurada')
      throw new Error(
        'No se pueden sincronizar servicios: No hay franquiciados con orquest_api_key configurada. ' +
        'Por favor, configura al menos un franquiciado con su API Key en la sección de Franquiciados.'
      )
    }

    console.log(`📋 Sincronizando servicios para ${franchisees.length} franquiciados...`)

    const results = []
    let totalServicesUpdated = 0

    for (const franchisee of franchisees) {
      try {
        console.log(`\n🔍 Franquiciado: ${franchisee.name} (${franchisee.email})`)

        const businessId = franchisee.orquest_business_id || ORQUEST_BUSINESS_ID
        const servicesUrl = `${ORQUEST_API_BASE_URL}/importer/api/v2/businesses/${businessId}/services`
        
        const response = await fetchWithRetry(servicesUrl, {
          headers: {
            'Authorization': `Bearer ${franchisee.orquest_api_key}`,
            'Content-Type': 'application/json',
          }
        }, 3)

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`HTTP ${response.status}: ${errorText}`)
        }

        const services: OrquestService[] = await response.json()
        console.log(`  ✅ Obtenidos ${services.length} servicios`)

        if (services.length > 0) {
          // Transformar y guardar servicios con referencia al franquiciado
          const servicesToUpsert = services.map((service) => ({
            id: service.id,
            nombre: service.name,
            zona_horaria: service.timeZone || null,
            latitud: service.lat || null,
            longitud: service.lon || null,
            datos_completos: service,
            franchisee_id: franchisee.id, // ✨ Vincular al franquiciado
            updated_at: new Date().toISOString()
          }))

          await upsertInChunks(supabaseClient, 'servicios_orquest', servicesToUpsert, UPSERT_CHUNK_SIZE)

          totalServicesUpdated += servicesToUpsert.length
          results.push({
            franchisee: franchisee.name,
            email: franchisee.email,
            services: servicesToUpsert.length,
            status: 'success'
          })
          console.log(`  💾 ${servicesToUpsert.length} servicios guardados`)
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
        console.error(`  ❌ Error en ${franchisee.name}:`, errorMessage)
        results.push({
          franchisee: franchisee.name,
          email: franchisee.email,
          error: errorMessage,
          status: 'error'
        })
      }
    }

    const successMessage = `✅ Sincronización completada: ${totalServicesUpdated} servicios actualizados de ${franchisees.length} franquiciados`
    console.log(`\n${successMessage}`)

    return new Response(
      JSON.stringify({ 
        message: successMessage,
        total_services: totalServicesUpdated,
        franchisees_processed: franchisees.length,
        results,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
    console.error('❌ Error en sincronización:', error)
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})

