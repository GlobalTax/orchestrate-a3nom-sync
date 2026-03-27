import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * DEPRECATED: This function is a proxy to `sincronizar-orquest-servicios`.
 * Use `sincronizar-orquest-servicios` directly for new integrations.
 * Kept for backwards compatibility with existing callers (e.g., Restaurantes.tsx).
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    console.log('sync_orquest_services: delegating to sincronizar-orquest-servicios')

    const { data, error } = await supabaseClient.functions.invoke(
      'sincronizar-orquest-servicios',
      { body: {} }
    )

    if (error) throw error

    // Map response to match expected format for Restaurantes.tsx
    return new Response(
      JSON.stringify({
        updated_services: data?.total_services || 0,
        franchisees_processed: data?.franchisees_processed || 0,
        ...data,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('sync_orquest_services error:', errorMessage)
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
