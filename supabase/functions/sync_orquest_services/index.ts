import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('🔄 Iniciando sincronización de servicios de Orquest...')

    // Get Orquest configuration
    const orquestBaseUrl = Deno.env.get('ORQUEST_BASE_URL')
    const orquestCookie = Deno.env.get('ORQUEST_COOKIE_JSESSIONID')

    if (!orquestBaseUrl || !orquestCookie) {
      throw new Error('ORQUEST_BASE_URL y ORQUEST_COOKIE_JSESSIONID deben estar configurados')
    }

    // Call Orquest API to get services
    const servicesUrl = `${orquestBaseUrl}/api/services`
    console.log(`📡 Consultando servicios: ${servicesUrl}`)

    const orquestResponse = await fetch(servicesUrl, {
      headers: {
        'Cookie': `JSESSIONID=${orquestCookie}`,
        'Content-Type': 'application/json',
      }
    })

    if (!orquestResponse.ok) {
      const errorText = await orquestResponse.text()
      throw new Error(`Error al obtener servicios de Orquest: ${orquestResponse.status} - ${errorText}`)
    }

    const services: OrquestService[] = await orquestResponse.json()
    console.log(`✅ Se obtuvieron ${services.length} servicios de Orquest`)

    if (services.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No hay servicios para sincronizar', count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Create Supabase client with service role for bypassing RLS
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Transform and upsert services to Supabase
    const servicesToUpsert = services.map((service) => ({
      id: service.id,
      nombre: service.name,
      zona_horaria: service.timeZone || null,
      latitud: service.lat || null,
      longitud: service.lon || null,
      datos_completos: service,
      updated_at: new Date().toISOString()
    }))

    console.log(`💾 Guardando ${servicesToUpsert.length} servicios en Supabase...`)

    const { error } = await supabaseClient
      .from('orquest_services')
      .upsert(servicesToUpsert, { onConflict: 'id' })

    if (error) {
      console.error('❌ Error al guardar en Supabase:', error)
      throw new Error(`Error al guardar servicios: ${error.message}`)
    }

    const successMessage = `✅ Sincronización completada: ${servicesToUpsert.length} servicios actualizados`
    console.log(successMessage)

    return new Response(
      JSON.stringify({ 
        message: successMessage,
        count: servicesToUpsert.length,
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
