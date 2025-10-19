import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Calendar, CheckCircle2, XCircle, AlertCircle, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";


interface SyncLog {
  id: string;
  sync_type: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  total_rows: number;
  inserted_rows: number;
  updated_rows: number;
  error_rows: number;
  errors: any[];
  trigger_source: string;
}

export default function Sync() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin, loading: roleLoading } = useUserRole();
  
  const [syncType, setSyncType] = useState<'employees' | 'schedules' | 'absences' | 'full'>('full');
  const [daysBack, setDaysBack] = useState('7');
  const [selectedCentro, setSelectedCentro] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<SyncLog | null>(null);
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      navigate("/dashboard");
      toast.error("No tienes permisos para acceder a esta página");
    }
  }, [isAdmin, roleLoading, navigate]);

  // Fetch centres for selector
  const { data: centros = [] } = useQuery({
    queryKey: ['centres'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('centres')
        .select('id, codigo, nombre, activo, orquest_service_id')
        .eq('activo', true)
        .not('orquest_service_id', 'is', null)
        .order('codigo');

      if (error) throw error;
      return data;
    },
  });

  // Fetch sync logs
  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: ['sync_logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sync_logs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as SyncLog[];
    },
    refetchInterval: 10000, // Auto-refresh every 10 seconds
  });

  // Execute sync mutation
  const executeSyncMutation = useMutation({
    mutationFn: async (params: { sync_type: string; days_back?: number; centro_code?: string }) => {
      const { data, error } = await supabase.functions.invoke('sync_orquest', {
        body: params,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Sincronización iniciada correctamente');
      queryClient.invalidateQueries({ queryKey: ['sync_logs'] });
    },
    onError: (error: any) => {
      toast.error(`Error al iniciar sincronización: ${error.message}`);
    },
  });

  const handleExecuteSync = () => {
    const params: any = {
      sync_type: syncType,
      days_back: parseInt(daysBack),
    };
    
    if (selectedCentro !== 'all') {
      params.centro_code = selectedCentro;
    }

    executeSyncMutation.mutate(params);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500"><CheckCircle2 className="mr-1 h-3 w-3" /> Completado</Badge>;
      case 'running':
        return <Badge className="bg-blue-500"><Clock className="mr-1 h-3 w-3 animate-spin" /> En proceso</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" /> Fallido</Badge>;
      case 'partial':
        return <Badge className="bg-orange-500"><AlertCircle className="mr-1 h-3 w-3" /> Parcial</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getSyncTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      employees: 'Empleados',
      schedules: 'Horarios',
      absences: 'Ausencias',
      full: 'Completo',
    };
    return labels[type] || type;
  };

  const toggleErrorExpansion = (logId: string) => {
    const newExpanded = new Set(expandedErrors);
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId);
    } else {
      newExpanded.add(logId);
    }
    setExpandedErrors(newExpanded);
  };

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="animate-spin h-8 w-8" />
      </div>
    );
  }

  if (!isAdmin) return null;

  // Calculate statistics
  const recentLogs = logs?.slice(0, 10) || [];
  const lastSync = recentLogs[0];
  const successRate = logs
    ? ((logs.filter(l => l.status === 'completed').length / logs.length) * 100).toFixed(1)
    : '0';
  const totalProcessed = logs?.reduce((acc, log) => acc + (log.total_rows || 0), 0) || 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <RefreshCw className="h-8 w-8" />
          <div>
            <h1 className="text-3xl font-bold">Sincronización con Orquest</h1>
            <p className="text-muted-foreground">Gestiona la sincronización automática de datos</p>
          </div>
        </div>

        {/* Statistics Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Última Sincronización</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {lastSync ? new Date(lastSync.started_at).toLocaleDateString('es-ES') : 'N/A'}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {lastSync ? new Date(lastSync.started_at).toLocaleTimeString('es-ES') : ''}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Tasa de Éxito</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{successRate}%</div>
              <p className="text-xs text-muted-foreground mt-1">Últimas 50 ejecuciones</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Registros Procesados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalProcessed.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">Total histórico</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Estado Actual</CardTitle>
            </CardHeader>
            <CardContent>
              {lastSync && getStatusBadge(lastSync.status)}
            </CardContent>
          </Card>
        </div>

        {/* Sync Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Ejecutar Sincronización Manual</CardTitle>
            <CardDescription>
              Configura y ejecuta una sincronización de datos desde Orquest
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="centro">Centro</Label>
                <Select value={selectedCentro} onValueChange={setSelectedCentro}>
                  <SelectTrigger id="centro">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los centros</SelectItem>
                    {centros.map((centro) => (
                      <SelectItem key={centro.codigo} value={centro.codigo}>
                        {centro.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="syncType">Tipo de Sincronización</Label>
                <Select value={syncType} onValueChange={(val: any) => setSyncType(val)}>
                  <SelectTrigger id="syncType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">Completo (Empleados + Horarios + Ausencias)</SelectItem>
                    <SelectItem value="employees">Solo Empleados</SelectItem>
                    <SelectItem value="schedules">Solo Horarios</SelectItem>
                    <SelectItem value="absences">Solo Ausencias</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="daysBack">Días hacia atrás</Label>
                <Input
                  id="daysBack"
                  type="number"
                  min="1"
                  max="90"
                  value={daysBack}
                  onChange={(e) => setDaysBack(e.target.value)}
                  placeholder="7"
                />
                <p className="text-xs text-muted-foreground">
                  Solo aplica a horarios y ausencias
                </p>
              </div>

              <div className="flex items-end">
                <Button 
                  onClick={handleExecuteSync} 
                  disabled={executeSyncMutation.isPending}
                  className="w-full"
                >
                  {executeSyncMutation.isPending ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Sincronizando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Ejecutar Ahora
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sync History */}
        <Card>
          <CardHeader>
            <CardTitle>Historial de Sincronizaciones</CardTitle>
            <CardDescription>Últimas 50 ejecuciones</CardDescription>
          </CardHeader>
          <CardContent>
            {logsLoading ? (
              <div className="flex justify-center py-8">
                <RefreshCw className="animate-spin h-8 w-8" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha/Hora</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Insertados</TableHead>
                    <TableHead className="text-right">Errores</TableHead>
                    <TableHead>Origen</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs?.map((log) => (
                    <>
                      <TableRow key={log.id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm">
                              {new Date(log.started_at).toLocaleDateString('es-ES')}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(log.started_at).toLocaleTimeString('es-ES')}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{getSyncTypeLabel(log.sync_type)}</TableCell>
                        <TableCell>{getStatusBadge(log.status)}</TableCell>
                        <TableCell className="text-right">{log.total_rows || 0}</TableCell>
                        <TableCell className="text-right">{log.inserted_rows || 0}</TableCell>
                        <TableCell className="text-right">
                          {log.error_rows > 0 ? (
                            <span className="text-destructive font-medium">{log.error_rows}</span>
                          ) : (
                            log.error_rows || 0
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {log.trigger_source === 'cron' ? 'Automático' : 'Manual'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {log.error_rows > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleErrorExpansion(log.id)}
                            >
                              {expandedErrors.has(log.id) ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                      {expandedErrors.has(log.id) && log.errors && log.errors.length > 0 && (
                        <TableRow>
                          <TableCell colSpan={8} className="bg-muted/30">
                            <div className="p-4 space-y-2">
                              <h4 className="font-semibold text-sm">Detalles de Errores:</h4>
                              <div className="space-y-1 max-h-60 overflow-y-auto">
                                {log.errors.map((error: any, idx: number) => (
                                  <div key={idx} className="text-xs bg-destructive/10 p-2 rounded">
                                    <span className="font-medium">{error.type}</span>
                                    {error.id && <span className="text-muted-foreground"> (ID: {error.id})</span>}
                                    <span className="block mt-1 text-destructive">{error.error}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>Información</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div>
                <p className="font-medium">Sincronización Automática</p>
                <p className="text-muted-foreground">
                  El sistema ejecuta automáticamente una sincronización completa diariamente a las 02:00 UTC,
                  procesando los últimos 7 días de datos.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div>
                <p className="font-medium">Gestión de Errores</p>
                <p className="text-muted-foreground">
                  Los errores individuales no detienen la sincronización completa. Cada registro se procesa
                  independientemente y los errores se registran para revisión.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
  );
}
