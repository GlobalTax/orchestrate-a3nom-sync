import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGINS = Deno.env.get('ALLOWED_ORIGINS')?.split(',') || ['*'];

function getCorsHeaders(origin: string | null) {
  if (ALLOWED_ORIGINS.includes('*')) {
    return {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    };
  }
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0] || '';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

interface SyncParams {
  sync_type: 'employees' | 'schedules' | 'absences' | 'full';
  start_date?: string;
  end_date?: string;
  days_back?: number;
  centro_code?: string; // Optional: sync specific center
}

interface SyncResult {
  total: number;
  inserted: number;
  updated: number;
  errors: number;
  errorDetails: any[];
}

interface Centro {
  id: string;
  codigo: string;
  nombre: string;
  orquest_service_id: string | null;
  orquest_business_id: string | null;
  activo: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(req.headers.get('origin')) })
  }

  let logId: string | null = null;
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    const { sync_type, start_date, end_date, days_back, centro_code } = await req.json() as SyncParams;
    
    console.log('🔄 Starting sync:', { sync_type, start_date, end_date, days_back, centro_code });

    // Validate user has permission to sync this centro
    const authHeader = req.headers.get('Authorization');
    if (authHeader && centro_code) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabaseClient.auth.getUser(token);
      
      if (user) {
        const { data: userCentres } = await supabaseClient
          .from('v_user_centres')
          .select('centro_code')
          .eq('user_id', user.id);
        
        const allowedCentros = userCentres?.map(c => c.centro_code) || [];
        
        if (!allowedCentros.includes(centro_code)) {
          return new Response(
            JSON.stringify({ error: 'No tienes permisos para sincronizar este restaurante' }),
            { status: 403, headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // Calculate date range
    let startDate: string;
    let endDate: string;

    if (start_date && end_date) {
      startDate = start_date;
      endDate = end_date;
    } else if (days_back) {
      const today = new Date();
      const pastDate = new Date();
      pastDate.setDate(today.getDate() - days_back);
      startDate = pastDate.toISOString().split('T')[0];
      endDate = today.toISOString().split('T')[0];
    } else {
      throw new Error('Must provide either start_date/end_date or days_back');
    }

    // Get Orquest configuration
    const orquestBaseUrl = Deno.env.get('ORQUEST_BASE_URL') || 'https://pre-mc.orquest.es';
    const defaultBusinessId = Deno.env.get('ORQUEST_BUSINESS_ID') || 'MCDONALDS_ES';
    const globalApiKey = Deno.env.get('ORQUEST_API_KEY');
    // Legacy fallback - JSESSIONID cookie (deprecated, prefer API Key)
    const orquestCookie = Deno.env.get('ORQUEST_COOKIE_JSESSIONID');

    if (!globalApiKey && !orquestCookie) {
      throw new Error('ORQUEST_API_KEY or ORQUEST_COOKIE_JSESSIONID must be configured');
    }

    // Fetch restaurant_services with centre info (N services per restaurant)
    const { data: restaurantServices, error: rsError } = await supabaseClient
      .from('restaurant_services')
      .select(`
        id,
        orquest_service_id,
        descripcion,
        centro_id,
        centres:centro_id (
          id,
          codigo,
          nombre,
          orquest_business_id,
          activo
        )
      `)
      .eq('activo', true);

    if (rsError) throw rsError;

    // Fetch franchisee API keys for Bearer token auth
    const { data: franchisees } = await supabaseClient
      .from('franchisees')
      .select('id, orquest_api_key, orquest_business_id');

    const franchiseeKeyMap = new Map<string, { apiKey: string; businessId: string }>();
    for (const f of franchisees || []) {
      if (f.orquest_api_key) {
        franchiseeKeyMap.set(f.id, {
          apiKey: f.orquest_api_key,
          businessId: f.orquest_business_id || defaultBusinessId,
        });
      }
    }

    // Group services by centro
    const centrosMap = new Map<string, {
      centro: any;
      serviceIds: string[];
    }>();

    for (const rs of restaurantServices || []) {
      const centreData = rs.centres as any;
      if (!centreData || Array.isArray(centreData) || !centreData.activo) continue;

      const centroId = centreData.id;
      if (!centrosMap.has(centroId)) {
        centrosMap.set(centroId, {
          centro: centreData,
          serviceIds: [],
        });
      }
      centrosMap.get(centroId)!.serviceIds.push(rs.orquest_service_id);
    }

    // Filter by centro_code if provided and create array
    let centrosToSync = Array.from(centrosMap.values()).filter(entry => 
      !centro_code || entry.centro.codigo === centro_code
    );

    // Fallback to centres.orquest_service_id if no restaurant_services found
    if (centrosToSync.length === 0) {
      console.log('⚠️ No restaurant_services found, falling back to centres.orquest_service_id');
      let fallbackQuery = supabaseClient
        .from('centres')
        .select('id, codigo, nombre, orquest_service_id, orquest_business_id, activo')
        .eq('activo', true)
        .not('orquest_service_id', 'is', null);

      if (centro_code) {
        fallbackQuery = fallbackQuery.eq('codigo', centro_code);
      }

      const { data: centres, error: centrosError } = await fallbackQuery;
      if (centrosError) throw centrosError;

      // Convert to same format
      centrosToSync = (centres || []).map(c => ({
        centro: c,
        serviceIds: [c.orquest_service_id],
      }));
    }

    const centros = centrosToSync.map(c => c.centro);

    if (centros.length === 0) {
      throw new Error(centro_code 
        ? `Centro ${centro_code} not found or not configured for Orquest`
        : 'No centres configured for Orquest sync');
    }

    // Resolve auth credentials for each centro
    const getAuthForCentro = (centro: any): { apiKey: string | null; businessId: string } => {
      // Try franchisee API key first
      if (centro.franchisee_id && franchiseeKeyMap.has(centro.franchisee_id)) {
        const f = franchiseeKeyMap.get(centro.franchisee_id)!;
        return { apiKey: f.apiKey, businessId: f.businessId };
      }
      // Fall back to global API key
      if (globalApiKey) {
        return { apiKey: globalApiKey, businessId: centro.orquest_business_id || defaultBusinessId };
      }
      // Legacy: no API key, will use JSESSIONID cookie
      return { apiKey: null, businessId: centro.orquest_business_id || defaultBusinessId };
    };

    console.log(`📍 Found ${centros.length} restaurant(s) to sync with ${centrosToSync.reduce((sum, c) => sum + c.serviceIds.length, 0)} total services`);

    // Create sync log entry
    const { data: logData, error: logError } = await supabaseClient
      .from('sync_logs')
      .insert({
        sync_type,
        status: 'running',
        params: { start_date: startDate, end_date: endDate, days_back, centro_code },
        triggered_by: req.headers.get('x-user-id') || null,
        trigger_source: req.headers.get('x-trigger-source') || 'manual',
      })
      .select()
      .single();

    if (logError) throw logError;
    logId = logData.id;

    console.log(`📝 Created sync log: ${logId}`);

    // Execute sync for each restaurant and its services
    let totalProcessed = 0;
    let totalInserted = 0;
    let totalUpdated = 0;
    let totalErrors = 0;
    const allErrors: any[] = [];

    for (const { centro, serviceIds } of centrosToSync) {
      console.log(`\n🏪 Syncing restaurant: ${centro.nombre} (${centro.codigo})`);
      console.log(`   Services: ${serviceIds.join(', ')}`);

      const auth = getAuthForCentro(centro);

      if (sync_type === 'employees' || sync_type === 'full') {
        for (const serviceId of serviceIds) {
          console.log(`\n   📡 Syncing employees for service ${serviceId}...`);
          const result = await syncEmployees(
            supabaseClient,
            orquestBaseUrl,
            auth,
            orquestCookie,
            serviceId,
            centro.codigo
          );

          totalProcessed += result.total;
          totalInserted += result.inserted;
          totalUpdated += result.updated;
          totalErrors += result.errors;
          allErrors.push(...result.errorDetails);

          console.log(`   ✅ Employees synced for service ${serviceId}: +${result.inserted} inserted, ~${result.updated} updated`);
        }
      }

      if (sync_type === 'schedules' || sync_type === 'full') {
        for (const serviceId of serviceIds) {
          console.log(`\n   📅 Syncing schedules for service ${serviceId}...`);
          const result = await syncSchedules(
            supabaseClient,
            orquestBaseUrl,
            auth,
            orquestCookie,
            startDate,
            endDate,
            serviceId,
            centro.codigo
          );

          totalProcessed += result.total;
          totalInserted += result.inserted;
          totalUpdated += result.updated;
          totalErrors += result.errors;
          allErrors.push(...result.errorDetails);

          console.log(`   ✅ Schedules synced for service ${serviceId}: +${result.inserted} inserted, ~${result.updated} updated`);
        }
      }

      if (sync_type === 'absences' || sync_type === 'full') {
        console.log(`\n   🏖️ Syncing absences for restaurant ${centro.codigo}...`);
        const result = await syncAbsences(
          supabaseClient,
          orquestBaseUrl,
          auth,
          orquestCookie,
          startDate,
          endDate,
          serviceIds[0],
          centro.codigo
        );
        totalProcessed += result.total;
        totalInserted += result.inserted;
        totalUpdated += result.updated;
        totalErrors += result.errors;
        allErrors.push(...result.errorDetails);
      }
    }

    // Update sync log with results
    const finalStatus = totalErrors > 0 ? (totalProcessed > totalErrors ? 'partial' : 'failed') : 'completed';
    
    await supabaseClient
      .from('sync_logs')
      .update({
        status: finalStatus,
        completed_at: new Date().toISOString(),
        total_rows: totalProcessed,
        processed_rows: totalProcessed,
        inserted_rows: totalInserted,
        updated_rows: totalUpdated,
        error_rows: totalErrors,
        errors: allErrors,
      })
      .eq('id', logId);

    console.log(`✅ Sync completed: ${finalStatus}`);

    return new Response(
      JSON.stringify({
        success: true,
        log_id: logId,
        status: finalStatus,
        summary: {
          total: totalProcessed,
          inserted: totalInserted,
          updated: totalUpdated,
          errors: totalErrors,
          centres_synced: centros.length,
        },
      }),
      { headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Sync error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;

    if (logId) {
      await supabaseClient
        .from('sync_logs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          errors: [{ message: errorMessage, stack: errorStack }],
        })
        .eq('id', logId);
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});

// Build fetch headers based on available auth
function buildOrquestHeaders(auth: { apiKey: string | null; businessId: string }, legacyCookie: string | null): HeadersInit {
  if (auth.apiKey) {
    return {
      'Authorization': `Bearer ${auth.apiKey}`,
      'Content-Type': 'application/json',
    };
  }
  if (legacyCookie) {
    return {
      'Cookie': `JSESSIONID=${legacyCookie}`,
      'Content-Type': 'application/json',
    };
  }
  throw new Error('No authentication available');
}

// Build Orquest API URL using the v2 importer API path pattern
function buildOrquestUrl(
  baseUrl: string,
  auth: { apiKey: string | null; businessId: string },
  resource: string,
  queryParams?: Record<string, string>
): string {
  // Use /importer/api/v2/ path when using Bearer token (API Key)
  const path = auth.apiKey
    ? `${baseUrl}/importer/api/v2/businesses/${auth.businessId}/${resource}`
    : `${baseUrl}/api/${resource}`;

  if (queryParams && Object.keys(queryParams).length > 0) {
    const qs = new URLSearchParams(queryParams).toString();
    return `${path}?${qs}`;
  }
  return path;
}

async function fetchOrquest(url: string, headers: HeadersInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  const response = await fetch(url, { headers, signal: controller.signal });
  clearTimeout(timeoutId);
  return response;
}

async function syncEmployees(
  supabase: any,
  baseUrl: string,
  auth: { apiKey: string | null; businessId: string },
  legacyCookie: string | null,
  serviceId: string,
  centroCode: string
): Promise<SyncResult> {
  const result: SyncResult = { total: 0, inserted: 0, updated: 0, errors: 0, errorDetails: [] };

  try {
    const headers = buildOrquestHeaders(auth, legacyCookie);
    const apiUrl = buildOrquestUrl(baseUrl, auth, 'employees', { serviceId });

    const response = await fetchOrquest(apiUrl, headers);

    if (!response.ok) {
      throw new Error(`Orquest API error: ${response.status} - ${await response.text()}`);
    }

    const orquestEmployees = await response.json();

    if (!Array.isArray(orquestEmployees)) {
      throw new Error(`Unexpected Orquest response: expected array, got ${typeof orquestEmployees}`);
    }
    result.total = orquestEmployees.length;

    console.log(`  Found ${result.total} employees for ${centroCode}`);

    // Check which employees already exist for insert vs update tracking
    const orquestIds = orquestEmployees.map((e: any) => e.id).filter(Boolean);
    const { data: existingEmps } = await supabase
      .from('employees')
      .select('employee_id_orquest')
      .in('employee_id_orquest', orquestIds);
    const existingSet = new Set(existingEmps?.map((e: any) => e.employee_id_orquest) || []);

    // Batch upsert employees
    const BATCH_SIZE = 100;
    const employeeRows = orquestEmployees.map((emp: any) => ({
      employee_id_orquest: emp.id,
      nombre: emp.firstName || emp.name || 'Sin nombre',
      apellidos: emp.lastName || emp.surname || '',
      email: emp.email || null,
      centro: centroCode,
      fecha_alta: emp.startDate ? new Date(emp.startDate).toISOString().split('T')[0] : null,
      fecha_baja: emp.endDate ? new Date(emp.endDate).toISOString().split('T')[0] : null,
    }));

    for (let i = 0; i < employeeRows.length; i += BATCH_SIZE) {
      const batch = employeeRows.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from('employees')
        .upsert(batch, { onConflict: 'employee_id_orquest' });

      if (error) {
        result.errors += batch.length;
        result.errorDetails.push({
          type: 'employee_batch',
          centro: centroCode,
          error: error.message,
        });
      } else {
        for (const row of batch) {
          if (existingSet.has(row.employee_id_orquest)) {
            result.updated++;
          } else {
            result.inserted++;
          }
        }
      }
    }
  } catch (error) {
    console.error(`  Error syncing employees for ${centroCode}:`, error);
    result.errorDetails.push({
      type: 'employee_sync',
      centro: centroCode,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  return result;
}

async function syncSchedules(
  supabase: any,
  baseUrl: string,
  auth: { apiKey: string | null; businessId: string },
  legacyCookie: string | null,
  startDate: string,
  endDate: string,
  serviceId: string,
  centroCode: string
): Promise<SyncResult> {
  const result: SyncResult = { total: 0, inserted: 0, updated: 0, errors: 0, errorDetails: [] };

  try {
    const headers = buildOrquestHeaders(auth, legacyCookie);
    const apiUrl = buildOrquestUrl(baseUrl, auth, 'assignments', {
      startDate, endDate, serviceId,
    });

    const response = await fetchOrquest(apiUrl, headers);

    if (!response.ok) {
      throw new Error(`Orquest API error: ${response.status} - ${await response.text()}`);
    }

    const assignments = await response.json();

    if (!Array.isArray(assignments)) {
      throw new Error(`Unexpected Orquest response: expected array, got ${typeof assignments}`);
    }
    result.total = assignments.length;

    console.log(`  Found ${result.total} assignments for ${centroCode}`);

    // Get employee mapping for this centro
    const { data: employees } = await supabase
      .from('employees')
      .select('id, employee_id_orquest')
      .eq('centro', centroCode);

    const employeeMap = new Map(employees?.map((e: any) => [e.employee_id_orquest, e.id]) || []);

    // Build batch of schedule rows
    const BATCH_SIZE = 100;
    const scheduleRows: any[] = [];

    for (const assignment of assignments) {
      const employeeId = employeeMap.get(assignment.employeeId);
      if (!employeeId) {
        result.errors++;
        result.errorDetails.push({
          type: 'schedule',
          centro: centroCode,
          id: assignment.id,
          error: `Employee not found: ${assignment.employeeId}`,
        });
        continue;
      }

      // Extract time portion directly from Orquest strings to avoid timezone conversion
      // Orquest sends times in the service's local timezone (e.g., Europe/Madrid)
      const startTime = assignment.startTime;
      const endTime = assignment.endTime;
      const horaInicio = typeof startTime === 'string' ? startTime.split('T')[1]?.substring(0, 8) || '00:00:00' : '00:00:00';
      const horaFin = typeof endTime === 'string' ? endTime.split('T')[1]?.substring(0, 8) || '00:00:00' : '00:00:00';
      const [sh, sm] = horaInicio.split(':').map(Number);
      const [eh, em] = horaFin.split(':').map(Number);
      const hours = Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60);

      scheduleRows.push({
        employee_id: employeeId,
        fecha: assignment.date,
        hora_inicio: horaInicio,
        hora_fin: horaFin,
        horas_planificadas: hours,
        service_id: serviceId,
        tipo_asignacion: assignment.type || null,
      });
    }

    // Batch upsert schedules
    for (let i = 0; i < scheduleRows.length; i += BATCH_SIZE) {
      const batch = scheduleRows.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from('schedules')
        .upsert(batch, { onConflict: 'employee_id,fecha,service_id' });

      if (error) {
        result.errors += batch.length;
        result.errorDetails.push({ type: 'schedule_batch', centro: centroCode, error: error.message });
      } else {
        result.inserted += batch.length;
      }
    }
  } catch (error) {
    console.error(`  Error syncing schedules for ${centroCode}:`, error);
    result.errorDetails.push({
      type: 'schedule_sync',
      centro: centroCode,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  return result;
}

async function syncAbsences(
  supabase: any,
  baseUrl: string,
  auth: { apiKey: string | null; businessId: string },
  legacyCookie: string | null,
  startDate: string,
  endDate: string,
  serviceId: string,
  centroCode: string
): Promise<SyncResult> {
  const result: SyncResult = { total: 0, inserted: 0, updated: 0, errors: 0, errorDetails: [] };

  try {
    const headers = buildOrquestHeaders(auth, legacyCookie);
    const apiUrl = buildOrquestUrl(baseUrl, auth, 'absences', {
      startDate, endDate, serviceId,
    });

    const response = await fetchOrquest(apiUrl, headers);

    if (!response.ok) {
      throw new Error(`Orquest API error: ${response.status} - ${await response.text()}`);
    }

    const absences = await response.json();

    if (!Array.isArray(absences)) {
      throw new Error(`Unexpected Orquest response: expected array, got ${typeof absences}`);
    }
    result.total = absences.length;

    console.log(`  Found ${result.total} absences for ${centroCode}`);

    // Get employee mapping for this centro
    const { data: employees } = await supabase
      .from('employees')
      .select('id, employee_id_orquest')
      .eq('centro', centroCode);

    const employeeMap = new Map(employees?.map((e: any) => [e.employee_id_orquest, e.id]) || []);

    // Build batch of absence rows
    const BATCH_SIZE = 100;
    const absenceRows: any[] = [];

    for (const absence of absences) {
      const employeeId = employeeMap.get(absence.employeeId);
      if (!employeeId) {
        result.errors++;
        result.errorDetails.push({
          type: 'absence',
          centro: centroCode,
          id: absence.id,
          error: `Employee not found: ${absence.employeeId}`,
        });
        continue;
      }

      absenceRows.push({
        employee_id: employeeId,
        fecha: absence.date,
        tipo: absence.type || 'Ausencia',
        horas_ausencia: absence.hours || 8,
        motivo: absence.reason || null,
        service_id: serviceId,
      });
    }

    // Batch upsert absences
    for (let i = 0; i < absenceRows.length; i += BATCH_SIZE) {
      const batch = absenceRows.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from('absences')
        .upsert(batch, { onConflict: 'employee_id,fecha,tipo,service_id' });

      if (error) {
        result.errors += batch.length;
        result.errorDetails.push({ type: 'absence_batch', centro: centroCode, error: error.message });
      } else {
        result.inserted += batch.length;
      }
    }
  } catch (error) {
    console.error(`  Error syncing absences for ${centroCode}:`, error);
    result.errorDetails.push({
      type: 'absence_sync',
      centro: centroCode,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  return result;
}