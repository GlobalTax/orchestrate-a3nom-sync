import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, Database, CloudCog, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Layout from "@/components/Layout";
import { toast } from "sonner";

interface HealthLog {
  id: string;
  checked_at: string;
  overall_status: 'healthy' | 'degraded' | 'down';
  supabase_status: string;
  supabase_latency_ms: number;
  orquest_status: string;
  orquest_latency_ms: number;
  orquest_error: string | null;
  last_sync_status: string;
  last_sync_at: string;
  employees_count: number;
  schedules_count: number;
  absences_count: number;
  payrolls_count: number;
}

export default function Health() {
  const [isChecking, setIsChecking] = useState(false);

  // Fetch latest health check
  const { data: latestHealth, refetch: refetchHealth } = useQuery({
    queryKey: ['latest-health'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_health_logs')
        .select('*')
        .order('checked_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as HealthLog | null;
    },
    refetchInterval: 60000, // Refetch every minute
  });

  // Fetch latency history for chart (last 24 hours)
  const { data: latencyHistory } = useQuery({
    queryKey: ['latency-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_health_logs')
        .select('checked_at, orquest_latency_ms, supabase_latency_ms')
        .gte('checked_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('checked_at', { ascending: true });

      if (error) throw error;
      return data.map(log => ({
        time: new Date(log.checked_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
        orquest: log.orquest_latency_ms || 0,
        supabase: log.supabase_latency_ms || 0,
      }));
    },
  });

  const runHealthCheck = async () => {
    setIsChecking(true);
    try {
      const { error } = await supabase.functions.invoke('check_system_health');
      if (error) throw error;
      
      toast.success('Health check completado');
      await refetchHealth();
    } catch (error: any) {
      toast.error(`Error: ${error.message}`);
    } finally {
      setIsChecking(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'ok':
        return <Badge className="bg-success"><CheckCircle2 className="mr-1 h-3 w-3" /> Saludable</Badge>;
      case 'degraded':
      case 'slow':
        return <Badge className="bg-warning"><AlertCircle className="mr-1 h-3 w-3" /> Degradado</Badge>;
      case 'down':
      case 'error':
      case 'unreachable':
        return <Badge variant="destructive"><AlertCircle className="mr-1 h-3 w-3" /> Caído</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Activity className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Estado del Sistema</h1>
              <p className="text-muted-foreground">Monitoreo de salud y rendimiento</p>
            </div>
          </div>
          <Button onClick={runHealthCheck} disabled={isChecking}>
            {isChecking ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Verificando...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Ejecutar Check
              </>
            )}
          </Button>
        </div>

        {/* Overall Status */}
        <Card>
          <CardHeader>
            <CardTitle>Estado General</CardTitle>
            <CardDescription>
              Última verificación: {latestHealth ? new Date(latestHealth.checked_at).toLocaleString('es-ES') : 'N/A'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              {latestHealth && getStatusBadge(latestHealth.overall_status)}
              <span className="text-2xl font-bold">
                {latestHealth?.overall_status === 'healthy' ? 'Sistema Operativo' : 
                 latestHealth?.overall_status === 'degraded' ? 'Rendimiento Reducido' : 
                 'Sistema Caído'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Service Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Database className="h-4 w-4" />
                Supabase
              </CardTitle>
            </CardHeader>
            <CardContent>
              {latestHealth && getStatusBadge(latestHealth.supabase_status)}
              <div className="mt-2 text-sm text-muted-foreground">
                Latencia: {latestHealth?.supabase_latency_ms || 0}ms
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CloudCog className="h-4 w-4" />
                Orquest API
              </CardTitle>
            </CardHeader>
            <CardContent>
              {latestHealth && getStatusBadge(latestHealth.orquest_status)}
              <div className="mt-2 text-sm text-muted-foreground">
                Latencia: {latestHealth?.orquest_latency_ms || 0}ms
              </div>
              {latestHealth?.orquest_error && (
                <div className="mt-2 text-xs text-destructive">
                  Error: {latestHealth.orquest_error}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Última Sincronización
              </CardTitle>
            </CardHeader>
            <CardContent>
              {latestHealth && getStatusBadge(latestHealth.last_sync_status || 'unknown')}
              <div className="mt-2 text-sm text-muted-foreground">
                {latestHealth?.last_sync_at 
                  ? new Date(latestHealth.last_sync_at).toLocaleString('es-ES')
                  : 'N/A'}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Latency Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Latencia de APIs (Últimas 24 horas)</CardTitle>
            <CardDescription>Tiempo de respuesta en milisegundos</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={latencyHistory || []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="time" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))' 
                  }}
                />
                <Line type="monotone" dataKey="orquest" stroke="hsl(var(--primary))" name="Orquest" strokeWidth={2} />
                <Line type="monotone" dataKey="supabase" stroke="hsl(var(--success))" name="Supabase" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Database Sizes */}
        <Card>
          <CardHeader>
            <CardTitle>Tamaño de Tablas</CardTitle>
            <CardDescription>Cantidad de registros en tablas principales</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">{latestHealth?.employees_count.toLocaleString() || 0}</div>
                <div className="text-sm text-muted-foreground">Empleados</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">{latestHealth?.schedules_count.toLocaleString() || 0}</div>
                <div className="text-sm text-muted-foreground">Horarios</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">{latestHealth?.absences_count.toLocaleString() || 0}</div>
                <div className="text-sm text-muted-foreground">Ausencias</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">{latestHealth?.payrolls_count.toLocaleString() || 0}</div>
                <div className="text-sm text-muted-foreground">Nóminas</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
