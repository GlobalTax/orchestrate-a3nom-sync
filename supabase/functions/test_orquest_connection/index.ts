import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { baseUrl, jsessionId } = await req.json();

    if (!baseUrl || !jsessionId) {
      return new Response(
        JSON.stringify({ success: false, message: 'Faltan parámetros requeridos (baseUrl o jsessionId)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Testing Orquest connection to: ${baseUrl}`);

    // Test connection by querying services
    const response = await fetch(`${baseUrl}/api/services`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `JSESSIONID=${jsessionId}`,
      },
    });

    console.log(`Orquest API response status: ${response.status}`);

    if (!response.ok) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `Error al conectar con Orquest: ${response.status} ${response.statusText}`,
          status: response.status
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const serviceCount = Array.isArray(data) ? data.length : 0;

    console.log(`Successfully connected to Orquest. Services found: ${serviceCount}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `✅ Conexión exitosa (${serviceCount} servicios encontrados)`,
        serviceCount,
        services: data
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in test_orquest_connection:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Error desconocido al probar la conexión' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
