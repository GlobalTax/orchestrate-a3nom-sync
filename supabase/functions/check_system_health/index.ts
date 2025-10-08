import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HealthCheckResult {
  overall_status: 'healthy' | 'degraded' | 'down';
  supabase_status: 'ok' | 'slow' | 'error';
  supabase_latency_ms: number | null;
  orquest_status: 'ok' | 'slow' | 'error' | 'unreachable';
  orquest_latency_ms: number | null;
  orquest_error: string | null;
  last_sync_status: string | null;
  last_sync_at: string | null;
  employees_count: number;
  schedules_count: number;
  absences_count: number;
  payrolls_count: number;
  details: Record<string, any>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const result: HealthCheckResult = {
      overall_status: 'healthy',
      supabase_status: 'ok',
      supabase_latency_ms: null,
      orquest_status: 'ok',
      orquest_latency_ms: null,
      orquest_error: null,
      last_sync_status: null,
      last_sync_at: null,
      employees_count: 0,
      schedules_count: 0,
      absences_count: 0,
      payrolls_count: 0,
      details: {},
    };

    // 1. Check Supabase Connection
    const supabaseStart = performance.now();
    try {
      const { count, error } = await supabase
        .from('employees')
        .select('*', { count: 'exact', head: true });
      
      const supabaseLatency = Math.round(performance.now() - supabaseStart);
      result.supabase_latency_ms = supabaseLatency;
      
      if (error) {
        result.supabase_status = 'error';
        result.overall_status = 'down';
        console.error('Supabase check failed:', error);
      } else if (supabaseLatency > 1000) {
        result.supabase_status = 'slow';
        result.overall_status = 'degraded';
      }
    } catch (error) {
      result.supabase_status = 'error';
      result.overall_status = 'down';
      console.error('Supabase check exception:', error);
    }

    // 2. Check Orquest Connection (via proxy)
    const orquestStart = performance.now();
    try {
      const orquestResponse = await supabase.functions.invoke('orquest_proxy', {
        body: {
          path: '/api/employees',
          method: 'GET',
          query: { limit: 1 }
        },
      });

      const orquestLatency = Math.round(performance.now() - orquestStart);
      result.orquest_latency_ms = orquestLatency;

      if (orquestResponse.error) {
        result.orquest_status = 'error';
        result.orquest_error = orquestResponse.error.message;
        result.overall_status = result.overall_status === 'down' ? 'down' : 'degraded';
        console.error('Orquest check failed:', orquestResponse.error);
      } else if (orquestLatency > 3000) {
        result.orquest_status = 'slow';
        result.overall_status = result.overall_status === 'down' ? 'down' : 'degraded';
      }
    } catch (error) {
      result.orquest_status = 'unreachable';
      result.orquest_error = error instanceof Error ? error.message : 'Unknown error';
      result.overall_status = 'degraded';
      console.error('Orquest check exception:', error);
    }

    // 3. Check Last Sync Status
    try {
      const { data: lastSync } = await supabase
        .from('sync_logs')
        .select('status, completed_at')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastSync) {
        result.last_sync_status = lastSync.status;
        result.last_sync_at = lastSync.completed_at;

        if (lastSync.status === 'failed') {
          result.overall_status = result.overall_status === 'down' ? 'down' : 'degraded';
        }
      }
    } catch (error) {
      console.error('Error checking last sync:', error);
    }

    // 4. Get Table Sizes
    const tables: Array<'employees' | 'schedules' | 'absences' | 'payrolls'> = ['employees', 'schedules', 'absences', 'payrolls'];
    for (const table of tables) {
      try {
        const { count } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });
        
        const countKey = `${table}_count` as 'employees_count' | 'schedules_count' | 'absences_count' | 'payrolls_count';
        result[countKey] = count || 0;
      } catch (error) {
        console.error(`Error counting ${table}:`, error);
      }
    }

    // 5. Save Health Check Result
    try {
      await supabase.from('system_health_logs').insert(result);
    } catch (error) {
      console.error('Error saving health check result:', error);
    }

    console.log('Health check completed:', result.overall_status);

    return new Response(
      JSON.stringify(result),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in check_system_health:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
