import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { service_id, business_id } = await req.json();

    if (!service_id) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Service ID es requerido para probar la conexión' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Testing Orquest connection for service: ${service_id}, business: ${business_id || 'default'}`);

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Call orquest_proxy to test connection
    const { data: proxyData, error: proxyError } = await supabaseClient.functions.invoke('orquest_proxy', {
      body: {
        path: '/api/employees',
        method: 'GET',
        query: { serviceId: service_id },
        businessId: business_id || undefined
      }
    });

    if (proxyError || !proxyData) {
      console.error('Orquest proxy error:', proxyError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Error al conectar con Orquest a través del proxy',
          error: proxyError?.message
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Count employees returned
    const employeesCount = Array.isArray(proxyData) ? proxyData.length : 0;

    console.log(`Successfully connected to Orquest service ${service_id}. Employees found: ${employeesCount}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `✅ Conexión exitosa con service ${service_id} (${employeesCount} empleados)`,
        employees_count: employeesCount,
        service_id,
        business_id
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
