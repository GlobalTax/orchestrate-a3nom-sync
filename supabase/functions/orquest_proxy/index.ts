import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { path, method = 'GET', query = {}, body } = await req.json();

    if (!path) {
      return new Response(
        JSON.stringify({ error: 'Path parameter is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const baseUrl = Deno.env.get('ORQUEST_BASE_URL');
    const jsessionId = Deno.env.get('ORQUEST_COOKIE_JSESSIONID');

    if (!baseUrl || !jsessionId) {
      console.error('Missing Orquest configuration');
      return new Response(
        JSON.stringify({ error: 'Orquest configuration not found' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build query string
    const queryString = new URLSearchParams(query).toString();
    const url = `${baseUrl}${path}${queryString ? `?${queryString}` : ''}`;

    console.log(`Proxying request to Orquest: ${method} ${url}`);

    // Prepare request options
    const requestOptions: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `JSESSIONID=${jsessionId}`,
      },
    };

    if (body && method !== 'GET') {
      requestOptions.body = JSON.stringify(body);
    }

    // Forward request to Orquest
    const response = await fetch(url, requestOptions);
    const data = await response.json();

    if (!response.ok) {
      console.error(`Orquest API error: ${response.status}`, data);
      return new Response(
        JSON.stringify({ 
          error: 'Orquest API error', 
          status: response.status,
          details: data 
        }),
        { 
          status: response.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Orquest request successful: ${method} ${path}`);

    return new Response(
      JSON.stringify(data),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in orquest_proxy function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
