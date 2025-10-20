import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BUSINESS_ID = 'MCDONALDS_ES'; // Todos usan el mismo

interface OrquestService {
  id: string;
  name: string;
  timeZone?: string;
  lat?: number;
  lon?: number;
  [key: string]: any;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('🔄 Iniciando sincronización de servicios de Orquest...')

    const orquestBaseUrl = Deno.env.get('ORQUEST_BASE_URL')
    if (!orquestBaseUrl) {
      throw new Error(
        '❌ ORQUEST_BASE_URL no configurado. ' +
        'Configúralo en: Supabase Dashboard > Edge Functions > Secrets'
      )
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Obtener todos los franquiciados con API Key configurada
    const { data: franchisees, error: franchiseesError } = await supabaseClient
      .from('franchisees')
      .select('id, name, email, orquest_api_key')
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

        // Endpoint documentado en Swagger
        const servicesUrl = `${orquestBaseUrl}/importer/api/v2/businesses/${BUSINESS_ID}/services`
        
        const response = await fetch(servicesUrl, {
          headers: {
            'Authorization': `Bearer ${franchisee.orquest_api_key}`,
            'Content-Type': 'application/json',
          }
        })

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

          const { error: upsertError } = await supabaseClient
            .from('orquest_services')
            .upsert(servicesToUpsert, { onConflict: 'id' })

          if (upsertError) throw upsertError

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

