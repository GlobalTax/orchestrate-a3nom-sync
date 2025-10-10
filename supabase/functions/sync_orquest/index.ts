import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    return new Response(null, { headers: corsHeaders })
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
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
    const orquestBaseUrl = Deno.env.get('ORQUEST_BASE_URL');
    const orquestCookie = Deno.env.get('ORQUEST_COOKIE_JSESSIONID');

    if (!orquestBaseUrl || !orquestCookie) {
      throw new Error('ORQUEST_BASE_URL and ORQUEST_COOKIE_JSESSIONID must be configured');
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

      if (sync_type === 'employees' || sync_type === 'full') {
        for (const serviceId of serviceIds) {
          console.log(`\n   📡 Syncing employees for service ${serviceId}...`);
          const result = await syncEmployees(
            supabaseClient,
            orquestBaseUrl,
            orquestCookie,
            serviceId,
            centro.orquest_business_id,
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
            orquestCookie,
            startDate,
            endDate,
            serviceId,
            centro.orquest_business_id,
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
        // Get first service for absences sync (not filtered by service in Orquest)
        const result = await syncAbsences(
          supabaseClient,
          orquestBaseUrl,
          orquestCookie,
          startDate,
          endDate,
          serviceIds[0],
          centro.orquest_business_id,
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
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});

async function syncEmployees(
  supabase: any,
  baseUrl: string,
  cookie: string,
  serviceId: string,
  businessId: string | null,
  centroCode: string
): Promise<SyncResult> {
  const result: SyncResult = { total: 0, inserted: 0, updated: 0, errors: 0, errorDetails: [] };

  try {
    // Build API URL with serviceId and optionally businessId
    let apiUrl = `${baseUrl}/api/employees?serviceId=${serviceId}`;
    if (businessId) {
      apiUrl += `&businessId=${businessId}`;
    }

    const response = await fetch(apiUrl, {
      headers: {
        'Cookie': `JSESSIONID=${cookie}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Orquest API error: ${response.status}`);
    }

    const orquestEmployees = await response.json();
    result.total = orquestEmployees.length;

    console.log(`  Found ${result.total} employees for ${centroCode}`);

    // Process each employee
    for (const emp of orquestEmployees) {
      try {
        const { error } = await supabase
          .from('employees')
          .upsert({
            employee_id_orquest: emp.id,
            nombre: emp.firstName || emp.name || 'Sin nombre',
            apellidos: emp.lastName || emp.surname || '',
            email: emp.email || null,
            centro: centroCode,
            fecha_alta: emp.startDate ? new Date(emp.startDate).toISOString().split('T')[0] : null,
            fecha_baja: emp.endDate ? new Date(emp.endDate).toISOString().split('T')[0] : null,
          }, { onConflict: 'employee_id_orquest' });

        if (error) {
          result.errors++;
          result.errorDetails.push({
            type: 'employee',
            centro: centroCode,
            id: emp.id,
            error: error.message,
          });
        } else {
          result.inserted++;
        }
      } catch (err) {
        result.errors++;
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        result.errorDetails.push({
          type: 'employee',
          centro: centroCode,
          id: emp.id,
          error: errorMessage,
        });
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
  cookie: string,
  startDate: string,
  endDate: string,
  serviceId: string,
  businessId: string | null,
  centroCode: string
): Promise<SyncResult> {
  const result: SyncResult = { total: 0, inserted: 0, updated: 0, errors: 0, errorDetails: [] };

  try {
    // Build API URL with serviceId, businessId, and date range
    let apiUrl = `${baseUrl}/api/assignments?startDate=${startDate}&endDate=${endDate}&serviceId=${serviceId}`;
    if (businessId) {
      apiUrl += `&businessId=${businessId}`;
    }

    const response = await fetch(apiUrl, {
      headers: {
        'Cookie': `JSESSIONID=${cookie}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Orquest API error: ${response.status}`);
    }

    const assignments = await response.json();
    result.total = assignments.length;

    console.log(`  Found ${result.total} assignments for ${centroCode}`);

    // Get employee mapping for this centro
    const { data: employees } = await supabase
      .from('employees')
      .select('id, employee_id_orquest')
      .eq('centro', centroCode);

    const employeeMap = new Map(employees?.map((e: any) => [e.employee_id_orquest, e.id]) || []);

    // Process each assignment
    for (const assignment of assignments) {
      try {
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

        const startTime = new Date(assignment.startTime);
        const endTime = new Date(assignment.endTime);
        const hours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);

        const { error } = await supabase
          .from('schedules')
          .upsert({
            employee_id: employeeId,
            fecha: assignment.date,
            hora_inicio: startTime.toISOString().split('T')[1].substring(0, 8),
            hora_fin: endTime.toISOString().split('T')[1].substring(0, 8),
            horas_planificadas: hours,
            service_id: serviceId,
            tipo_asignacion: assignment.type || null,
          }, { onConflict: 'employee_id,fecha,service_id' });

        if (error) {
          result.errors++;
          result.errorDetails.push({
            type: 'schedule',
            centro: centroCode,
            id: assignment.id,
            error: error.message,
          });
        } else {
          result.inserted++;
        }
      } catch (err) {
        result.errors++;
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        result.errorDetails.push({
          type: 'schedule',
          centro: centroCode,
          id: assignment.id,
          error: errorMessage,
        });
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
  cookie: string,
  startDate: string,
  endDate: string,
  serviceId: string,
  businessId: string | null,
  centroCode: string
): Promise<SyncResult> {
  const result: SyncResult = { total: 0, inserted: 0, updated: 0, errors: 0, errorDetails: [] };

  try {
    // Build API URL with serviceId, businessId, and date range
    let apiUrl = `${baseUrl}/api/absences?startDate=${startDate}&endDate=${endDate}&serviceId=${serviceId}`;
    if (businessId) {
      apiUrl += `&businessId=${businessId}`;
    }

    const response = await fetch(apiUrl, {
      headers: {
        'Cookie': `JSESSIONID=${cookie}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Orquest API error: ${response.status}`);
    }

    const absences = await response.json();
    result.total = absences.length;

    console.log(`  Found ${result.total} absences for ${centroCode}`);

    // Get employee mapping for this centro
    const { data: employees } = await supabase
      .from('employees')
      .select('id, employee_id_orquest')
      .eq('centro', centroCode);

    const employeeMap = new Map(employees?.map((e: any) => [e.employee_id_orquest, e.id]) || []);

    // Process each absence
    for (const absence of absences) {
      try {
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

        const { error } = await supabase
          .from('absences')
          .upsert({
            employee_id: employeeId,
            fecha: absence.date,
            tipo: absence.type || 'Ausencia',
            horas_ausencia: absence.hours || 8,
            motivo: absence.reason || null,
          }, { onConflict: 'employee_id,fecha,tipo' });

        if (error) {
          result.errors++;
          result.errorDetails.push({
            type: 'absence',
            centro: centroCode,
            id: absence.id,
            error: error.message,
          });
        } else {
          result.inserted++;
        }
      } catch (err) {
        result.errors++;
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        result.errorDetails.push({
          type: 'absence',
          centro: centroCode,
          id: absence.id,
          error: errorMessage,
        });
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