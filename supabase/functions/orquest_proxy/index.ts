import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = performance.now();

  try {
    const { path, method = 'GET', query = {}, body, businessId, franchiseeId } = await req.json();

    if (!path) {
      return new Response(
        JSON.stringify({ error: 'Path parameter is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const baseUrl = Deno.env.get('ORQUEST_BASE_URL');
    const defaultBusinessId = businessId || 'MCDONALDS_ES';

    if (!baseUrl) {
      console.error('Missing Orquest base URL');
      return new Response(
        JSON.stringify({ error: 'Orquest configuration not found' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== AUTENTICACIÓN DINÁMICA =====
    let authHeader: string | null = null;
    let authMethod = 'none';

    if (franchiseeId) {
      // Intentar obtener API Key del franquiciado desde Supabase
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      const { data: franchisee, error } = await supabaseClient
        .from('franchisees')
        .select('orquest_api_key, name')
        .eq('id', franchiseeId)
        .single();

      if (error) {
        console.warn(`Franchisee ${franchiseeId} not found:`, error.message);
      } else if (franchisee?.orquest_api_key) {
        // Usar Bearer Token
        authHeader = `Bearer ${franchisee.orquest_api_key}`;
        authMethod = 'bearer_token';
        console.log(`🔑 Usando API Key del franquiciado: ${franchisee.name}`);
      } else {
        console.warn(`Franchisee ${franchisee?.name || franchiseeId} no tiene API Key configurada`);
      }
    }

    // Fallback a Cookie JSESSIONID si no hay API Key
    if (!authHeader) {
      const jsessionId = Deno.env.get('ORQUEST_COOKIE_JSESSIONID');
      if (jsessionId) {
        authHeader = `JSESSIONID=${jsessionId}`;
        authMethod = 'cookie';
        console.log('🔑 Usando autenticación global (Cookie JSESSIONID)');
      }
    }

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authentication method available. Configure franchisee API key or global cookie.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build query string
    const queryParams = new URLSearchParams(query);
    
    // Añadir businessId al query si es necesario
    if (!path.includes('/businesses/') && !queryParams.has('businessId')) {
      queryParams.append('businessId', defaultBusinessId);
    }

    const queryString = queryParams.toString();
    const url = `${baseUrl}${path}${queryString ? `?${queryString}` : ''}`;

    console.log(`📡 Proxying request: ${method} ${url} (auth: ${authMethod})`);

    // Prepare request options
    const requestOptions: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(authMethod === 'bearer_token' 
          ? { 'Authorization': authHeader }
          : { 'Cookie': authHeader }
        ),
      },
    };

    if (body && method !== 'GET') {
      requestOptions.body = JSON.stringify(body);
    }

    // Forward request to Orquest
    const response = await fetch(url, requestOptions);
    const endTime = performance.now();
    const latencyMs = Math.round(endTime - startTime);
    
    const data = await response.json();

    if (!response.ok) {
      console.error(`❌ Orquest API error: ${response.status}`, data);
      return new Response(
        JSON.stringify({ 
          error: 'Orquest API error', 
          status: response.status,
          details: data,
          latency_ms: latencyMs,
          auth_method: authMethod
        }),
        { 
          status: response.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`✅ Orquest request successful: ${method} ${path} (${latencyMs}ms, auth: ${authMethod})`);

    return new Response(
      JSON.stringify({
        ...data,
        _metadata: { 
          latency_ms: latencyMs,
          auth_method: authMethod
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    const endTime = performance.now();
    const latencyMs = Math.round(endTime - startTime);
    
    console.error('❌ Error in orquest_proxy function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        latency_ms: latencyMs
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
