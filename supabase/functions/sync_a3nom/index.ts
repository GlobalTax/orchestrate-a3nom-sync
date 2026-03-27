import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * sync_a3nom - Sincroniza datos de A3Nom via IntegraLOOP API
 *
 * Endpoints utilizados:
 * - /api-global/v1/token - Obtener token temporal (2h)
 * - /api-global/v1/labor/getWorkers - Trabajadores
 * - /api-global/v1/labor/getPayrollConceptsMonthBi - Conceptos nominas mensuales
 * - /api-global/v1/labor/getCostCenters - Centros de coste
 * - /api-global/v1/labor/getPayrollCosts - Costes historicos nominas
 *
 * Secrets requeridos en Supabase:
 * - A3NOM_API_URL: URL base de IntegraLOOP (ej: https://api.integraloop.com)
 * - A3NOM_SUBSCRIPTION_KEY: Clave de suscripcion
 * - A3NOM_USER: Usuario de acceso
 * - A3NOM_PASSWORD: Contrasena de acceso
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SyncA3NomParams {
  sync_type: 'workers' | 'payroll_costs' | 'cost_centers' | 'full';
  company_id: string;      // Codigo de empresa en A3Nom/BILOOP (ej: "E00908")
  year?: number;
  month?: number;
  start_date?: string;     // YYYY-MM-DD
  end_date?: string;       // YYYY-MM-DD
}

interface A3NomToken {
  token: string;
  expiresAt: number;
}

// Token cache to avoid re-authenticating on every call within the same invocation
let cachedToken: A3NomToken | null = null;

async function getA3NomToken(apiUrl: string, subscriptionKey: string, user: string, password: string, companyId?: string): Promise<string> {
  // Return cached token if still valid (with 5min margin)
  if (cachedToken && Date.now() < cachedToken.expiresAt - 5 * 60 * 1000) {
    return cachedToken.token;
  }

  const url = new URL(`${apiUrl}/api-global/v1/token`);
  if (companyId) {
    url.searchParams.set('cif', companyId);
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'SUBSCRIPTION_KEY': subscriptionKey,
      'USER': user,
      'PASSWORD': password,
    },
  });

  if (!response.ok) {
    throw new Error(`A3Nom auth failed: ${response.status} ${await response.text()}`);
  }

  const result = await response.json();
  if (result.status !== 'OK' || !result.data?.token) {
    throw new Error(`A3Nom auth error: ${result.message || 'No token returned'}`);
  }

  cachedToken = {
    token: result.data.token,
    expiresAt: Date.now() + 2 * 60 * 60 * 1000, // 2 hours
  };

  return cachedToken.token;
}

async function callA3NomAPI(apiUrl: string, token: string, subscriptionKey: string, path: string, params?: Record<string, string>): Promise<any> {
  const url = new URL(`${apiUrl}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  const response = await fetch(url.toString(), {
    headers: {
      'SUBSCRIPTION_KEY': subscriptionKey,
      'token': token,
    },
    signal: controller.signal,
  });
  clearTimeout(timeoutId);

  if (!response.ok) {
    throw new Error(`A3Nom API error ${response.status}: ${await response.text()}`);
  }

  return response.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const { sync_type, company_id, year, month, start_date, end_date } = await req.json() as SyncA3NomParams;

    if (!company_id) {
      return new Response(
        JSON.stringify({ error: 'company_id is required (A3Nom company code)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get A3Nom credentials from secrets
    const apiUrl = Deno.env.get('A3NOM_API_URL');
    const subscriptionKey = Deno.env.get('A3NOM_SUBSCRIPTION_KEY');
    const user = Deno.env.get('A3NOM_USER');
    const password = Deno.env.get('A3NOM_PASSWORD');

    if (!apiUrl || !subscriptionKey || !user || !password) {
      throw new Error('A3Nom credentials not configured. Set A3NOM_API_URL, A3NOM_SUBSCRIPTION_KEY, A3NOM_USER, A3NOM_PASSWORD in Supabase secrets.');
    }

    console.log(`Starting A3Nom sync: ${sync_type} for company ${company_id}`);

    // Authenticate
    const token = await getA3NomToken(apiUrl, subscriptionKey, user, password);
    console.log('A3Nom authentication successful');

    const results: Record<string, { total: number; synced: number; errors: number }> = {};

    // --- SYNC WORKERS ---
    if (sync_type === 'workers' || sync_type === 'full') {
      console.log('Syncing workers from A3Nom...');
      try {
        const data = await callA3NomAPI(apiUrl, token, subscriptionKey, '/api-global/v1/labor/getWorkers', {
          Company_id: company_id,
        });

        const workers = data?.data?.workers || data?.workers || [];
        console.log(`Found ${workers.length} workers in A3Nom`);

        let synced = 0;
        let errors = 0;
        const BATCH_SIZE = 50;

        for (let i = 0; i < workers.length; i += BATCH_SIZE) {
          const batch = workers.slice(i, i + BATCH_SIZE);
          const rows = batch.map((w: any) => ({
            codtrabajador_a3nom: w.worker_id,
            nombre: w.name?.split(' ')[0] || w.name || '',
            apellidos: w.name?.split(' ').slice(1).join(' ') || '',
            email: w.email || null,
            centro: company_id,
            fecha_alta: w.admission_date ? formatA3Date(w.admission_date) : null,
            fecha_baja: w.leave_work_date ? formatA3Date(w.leave_work_date) : null,
          }));

          const { error } = await supabase
            .from('employees')
            .upsert(rows, { onConflict: 'codtrabajador_a3nom' });

          if (error) {
            console.error('Batch upsert error:', error.message);
            errors += batch.length;
          } else {
            synced += batch.length;
          }
        }

        results.workers = { total: workers.length, synced, errors };
      } catch (err) {
        console.error('Workers sync error:', err);
        results.workers = { total: 0, synced: 0, errors: 1 };
      }
    }

    // --- SYNC PAYROLL COSTS ---
    if (sync_type === 'payroll_costs' || sync_type === 'full') {
      console.log('Syncing payroll costs from A3Nom...');
      try {
        const params: Record<string, string> = { company_id };
        if (start_date) params.date_start = start_date.replace(/-/g, '');
        if (end_date) params.date_end = end_date.replace(/-/g, '');

        const data = await callA3NomAPI(apiUrl, token, subscriptionKey, '/api-global/v1/labor/getPayrollCosts', params);

        const costs = data?.data?.PayrollCosts || data?.PayrollCosts || [];
        console.log(`Found ${costs.length} payroll cost records`);

        // Map A3Nom worker IDs to our employee UUIDs
        const workerIds = [...new Set(costs.map((c: any) => c.worker_id))];
        const { data: employees } = await supabase
          .from('employees')
          .select('id, codtrabajador_a3nom')
          .in('codtrabajador_a3nom', workerIds);

        const employeeMap = new Map(employees?.map((e: any) => [e.codtrabajador_a3nom, e.id]) || []);

        let synced = 0;
        let errors = 0;
        const BATCH_SIZE = 100;

        for (let i = 0; i < costs.length; i += BATCH_SIZE) {
          const batch = costs.slice(i, i + BATCH_SIZE);
          const rows = batch
            .filter((c: any) => employeeMap.has(c.worker_id))
            .map((c: any) => ({
              employee_id: employeeMap.get(c.worker_id),
              periodo_inicio: c.date ? formatA3Date(c.date) : null,
              periodo_fin: c.date ? formatA3Date(c.date) : null,
              coste_total: c.concept_amount ? Number(c.concept_amount) : null,
            }));

          if (rows.length > 0) {
            const { error } = await supabase
              .from('payrolls')
              .insert(rows);

            if (error) {
              console.error('Payroll insert error:', error.message);
              errors += batch.length;
            } else {
              synced += rows.length;
            }
          }
        }

        results.payroll_costs = { total: costs.length, synced, errors };
      } catch (err) {
        console.error('Payroll costs sync error:', err);
        results.payroll_costs = { total: 0, synced: 0, errors: 1 };
      }
    }

    // --- SYNC COST CENTERS ---
    if (sync_type === 'cost_centers' || sync_type === 'full') {
      console.log('Syncing cost centers from A3Nom...');
      try {
        const data = await callA3NomAPI(apiUrl, token, subscriptionKey, '/api-global/v1/labor/getCostCenters', {
          Company_id: company_id,
        });

        const centers = data?.data?.costCenters || data?.costCenters || [];
        console.log(`Found ${centers.length} cost centers`);

        let synced = 0;
        let errors = 0;

        // Find the centro in our DB that matches this company_id
        const { data: centreData } = await supabase
          .from('centres')
          .select('id')
          .eq('codigo', company_id)
          .maybeSingle();

        if (centreData) {
          for (const center of centers) {
            const { error } = await supabase
              .from('cost_centres')
              .upsert({
                centro_id: centreData.id,
                a3_centro_code: center.code,
                descripcion: center.description,
                activo: true,
              }, { onConflict: 'centro_id,a3_centro_code' });

            if (error) {
              errors++;
            } else {
              synced++;
            }
          }
        }

        results.cost_centers = { total: centers.length, synced, errors };
      } catch (err) {
        console.error('Cost centers sync error:', err);
        results.cost_centers = { total: 0, synced: 0, errors: 1 };
      }
    }

    console.log('A3Nom sync completed:', results);

    return new Response(
      JSON.stringify({
        success: true,
        company_id,
        sync_type,
        results,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('A3Nom sync error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// A3Nom dates come in dd/mm/YYYY or YYYYMMDD format
function formatA3Date(dateStr: string): string | null {
  if (!dateStr) return null;

  // Handle dd/mm/YYYY
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }

  // Handle YYYYMMDD
  if (dateStr.length === 8 && !dateStr.includes('-')) {
    return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
  }

  // Already ISO format
  if (dateStr.includes('-')) {
    return dateStr.split('T')[0];
  }

  return null;
}
