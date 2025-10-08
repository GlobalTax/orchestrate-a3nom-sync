import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Alert {
  id: string;
  tipo: string;
  nombre: string;
  centro: string | null;
  umbral_valor: number | null;
  umbral_operador: string;
  periodo_calculo: string;
  canal: string[];
  destinatarios: any;
}

interface NotificationData {
  alert_id: string;
  tipo: string;
  severidad: string;
  titulo: string;
  mensaje: string;
  detalles: any;
  centro: string | null;
  enviada_email: boolean;
  email_enviado_at?: string;
  destinatario_user_id?: string;
  destinatario_email?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

  try {
    console.log('Starting compute_alerts execution...');

    // 1. Get all active alerts
    const { data: alerts, error: alertsError } = await supabaseClient
      .from('alerts')
      .select('*')
      .eq('activo', true);

    if (alertsError) {
      console.error('Error fetching alerts:', alertsError);
      throw alertsError;
    }

    console.log(`Found ${alerts?.length || 0} active alerts`);

    const notifications: NotificationData[] = [];

    // 2. Evaluate each alert
    for (const alert of alerts || []) {
      try {
        const result = await evaluateAlert(alert, supabaseClient);
        if (result.triggered && result.notification) {
          notifications.push(result.notification);
        }
      } catch (error) {
        console.error(`Error evaluating alert ${alert.id}:`, error);
      }
    }

    console.log(`Generated ${notifications.length} notifications`);

    // 3. Insert notifications and send emails
    if (notifications.length > 0) {
      for (const notif of notifications) {
        try {
          // Get users to notify
          const usersToNotify = await getUsersToNotify(notif, supabaseClient);
          
          // Create notification for each user
          for (const user of usersToNotify) {
            const notificationRecord = {
              ...notif,
              destinatario_user_id: user.user_id,
              destinatario_email: user.email
            };

            const { error: insertError } = await supabaseClient
              .from('alert_notifications')
              .insert(notificationRecord);

            if (insertError) {
              console.error('Error inserting notification:', insertError);
            }

            // Send email if configured
            if (notif.enviada_email && user.email) {
              try {
                await sendEmail(notif, user.email, resend);
              } catch (emailError) {
                console.error('Error sending email:', emailError);
              }
            }
          }
        } catch (error) {
          console.error('Error processing notification:', error);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        evaluated: alerts?.length || 0,
        triggered: notifications.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in compute_alerts:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function getUsersToNotify(notification: NotificationData, supabaseClient: any) {
  // Get admins and gestores for the centro
  const { data: userRoles, error } = await supabaseClient
    .from('user_roles')
    .select('user_id, profiles!inner(email)')
    .in('role', ['admin', 'gestor'])
    .or(`centro.eq.${notification.centro},role.eq.admin`);

  if (error) {
    console.error('Error fetching user roles:', error);
    return [];
  }

  return userRoles.map((ur: any) => ({
    user_id: ur.user_id,
    email: ur.profiles?.email
  })).filter((u: any) => u.email);
}

async function evaluateAlert(alert: Alert, supabaseClient: any) {
  const { tipo, centro, umbral_valor, umbral_operador, periodo_calculo } = alert;
  
  const { startDate, endDate } = calculatePeriod(periodo_calculo);
  console.log(`Evaluating alert ${alert.id} (${tipo}) for period ${startDate} to ${endDate}`);
  
  let shouldTrigger = false;
  let notification: NotificationData | null = null;
  
  try {
    switch (tipo) {
      case 'ABSENTISMO_ALTO': {
        const { data: metricsData, error } = await supabaseClient
          .rpc('get_hours_metrics', {
            p_start_date: startDate,
            p_end_date: endDate,
            p_centro: centro
          });
        
        if (error) throw error;
        
        const currentValue = metricsData?.[0]?.tasa_absentismo || 0;
        shouldTrigger = compareValue(currentValue, umbral_valor || 0, umbral_operador);
        
        if (shouldTrigger) {
          notification = {
            alert_id: alert.id,
            tipo: 'ABSENTISMO_ALTO',
            severidad: currentValue > 15 ? 'critica' : 'alta',
            titulo: `Absentismo elevado en ${centro || 'todos los centros'}`,
            mensaje: `La tasa de absentismo actual es ${currentValue.toFixed(2)}%, superando el umbral de ${umbral_valor}%`,
            detalles: {
              valor_actual: currentValue,
              umbral: umbral_valor,
              periodo: { startDate, endDate },
              centro
            },
            centro,
            enviada_email: alert.canal.includes('email'),
            email_enviado_at: alert.canal.includes('email') ? new Date().toISOString() : undefined
          };
        }
        break;
      }
      
      case 'COSTE_EXCESIVO': {
        const { data: costData, error } = await supabaseClient
          .rpc('get_planned_vs_actual_costs', {
            p_start_date: startDate,
            p_end_date: endDate,
            p_centro: centro
          });
        
        if (error) throw error;
        if (!costData || costData.length === 0) break;
        
        const desviacion = costData[0].costes_planificados > 0
          ? ((costData[0].costes_reales - costData[0].costes_planificados) / costData[0].costes_planificados) * 100
          : 0;
        
        shouldTrigger = compareValue(desviacion, umbral_valor || 0, umbral_operador);
        
        if (shouldTrigger) {
          notification = {
            alert_id: alert.id,
            tipo: 'COSTE_EXCESIVO',
            severidad: desviacion > 20 ? 'critica' : 'alta',
            titulo: `Desviación de costes en ${centro || 'todos los centros'}`,
            mensaje: `La desviación de costes es ${desviacion.toFixed(2)}%, superando el umbral de ${umbral_valor}%`,
            detalles: {
              desviacion_porcentaje: desviacion,
              costes_planificados: costData[0].costes_planificados,
              costes_reales: costData[0].costes_reales,
              umbral: umbral_valor,
              periodo: { startDate, endDate },
              centro
            },
            centro,
            enviada_email: alert.canal.includes('email'),
            email_enviado_at: alert.canal.includes('email') ? new Date().toISOString() : undefined
          };
        }
        break;
      }
      
      case 'DQ_CRITICA': {
        const { data: dqIssues, count, error } = await supabaseClient
          .from('dq_issues')
          .select('*', { count: 'exact' })
          .eq('severidad', 'critica')
          .eq('resuelto', false)
          .gte('created_at', startDate);
        
        if (error) throw error;
        
        shouldTrigger = compareValue(count || 0, umbral_valor || 0, umbral_operador);
        
        if (shouldTrigger) {
          notification = {
            alert_id: alert.id,
            tipo: 'DQ_CRITICA',
            severidad: 'critica',
            titulo: `Incidencias críticas de calidad de datos`,
            mensaje: `Se detectaron ${count} incidencias críticas no resueltas`,
            detalles: {
              total_incidencias: count,
              umbral: umbral_valor,
              periodo: { startDate, endDate },
              incidencias: dqIssues?.slice(0, 5)
            },
            centro,
            enviada_email: alert.canal.includes('email'),
            email_enviado_at: alert.canal.includes('email') ? new Date().toISOString() : undefined
          };
        }
        break;
      }
      
      case 'PLANIFICACION_VACIA': {
        const { data: schedules, error } = await supabaseClient
          .from('schedules')
          .select('fecha')
          .gte('fecha', startDate)
          .lte('fecha', endDate);
        
        if (error) throw error;
        
        const uniqueDates = new Set(schedules?.map((s: any) => s.fecha) || []);
        const daysWithSchedule = uniqueDates.size;
        const totalDays = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const percentageCovered = totalDays > 0 ? (daysWithSchedule / totalDays) * 100 : 0;
        
        shouldTrigger = compareValue(percentageCovered, umbral_valor || 0, umbral_operador);
        
        if (shouldTrigger) {
          notification = {
            alert_id: alert.id,
            tipo: 'PLANIFICACION_VACIA',
            severidad: percentageCovered < 50 ? 'critica' : 'alta',
            titulo: `Planificación incompleta`,
            mensaje: `Solo ${percentageCovered.toFixed(1)}% de los días tienen planificación`,
            detalles: {
              dias_con_planificacion: daysWithSchedule,
              dias_totales: totalDays,
              porcentaje_cobertura: percentageCovered,
              umbral: umbral_valor,
              periodo: { startDate, endDate }
            },
            centro,
            enviada_email: alert.canal.includes('email'),
            email_enviado_at: alert.canal.includes('email') ? new Date().toISOString() : undefined
          };
        }
        break;
      }
    }
  } catch (error) {
    console.error(`Error evaluating alert type ${tipo}:`, error);
  }
  
  return { triggered: shouldTrigger, notification };
}

function compareValue(current: number, threshold: number, operator: string): boolean {
  switch (operator) {
    case 'mayor_que': return current > threshold;
    case 'menor_que': return current < threshold;
    case 'igual_a': return current === threshold;
    default: return false;
  }
}

function calculatePeriod(periodo: string): { startDate: string; endDate: string } {
  const now = new Date();
  const endDate = now.toISOString().split('T')[0];
  let startDate: string;
  
  switch (periodo) {
    case 'ultimo_dia': {
      const date = new Date(now);
      date.setDate(date.getDate() - 1);
      startDate = date.toISOString().split('T')[0];
      break;
    }
    case 'ultima_semana': {
      const date = new Date(now);
      date.setDate(date.getDate() - 7);
      startDate = date.toISOString().split('T')[0];
      break;
    }
    case 'ultimo_mes': {
      const date = new Date(now);
      date.setMonth(date.getMonth() - 1);
      startDate = date.toISOString().split('T')[0];
      break;
    }
    default: {
      const date = new Date(now);
      date.setMonth(date.getMonth() - 1);
      startDate = date.toISOString().split('T')[0];
    }
  }
  
  return { startDate, endDate };
}

async function sendEmail(notification: NotificationData, email: string, resend: any) {
  try {
    await resend.emails.send({
      from: 'Alertas Orquest <onboarding@resend.dev>',
      to: email,
      subject: `🚨 ${notification.titulo}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #DC2626; margin-bottom: 16px;">${notification.titulo}</h2>
          <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 20px;">
            ${notification.mensaje}
          </p>
          <div style="background: #F3F4F6; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <strong style="color: #1F2937;">Detalles:</strong>
            <pre style="margin: 10px 0; font-size: 14px; color: #4B5563; white-space: pre-wrap; word-wrap: break-word;">${JSON.stringify(notification.detalles, null, 2)}</pre>
          </div>
          <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #E5E7EB;">
            <p style="color: #6B7280; font-size: 14px; margin: 0;">
              Esta es una alerta automática del sistema de gestión Orquest + A3Nom.
            </p>
          </div>
        </div>
      `
    });
    console.log(`Email sent to ${email}`);
  } catch (error) {
    console.error(`Failed to send email to ${email}:`, error);
    throw error;
  }
}
