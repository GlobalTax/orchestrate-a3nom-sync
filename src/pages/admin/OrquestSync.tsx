import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  RefreshCw, 
  Building2, 
  Users, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Clock,
  Activity,
  ChevronDown,
  ChevronUp,
  Calendar,
  Search
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useOrquestServicesSync } from "@/hooks/useOrquestServicesSync";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
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

export default function OrquestSync() {
  const queryClient = useQueryClient();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const {
    logs: servicesLogs,
    logsLoading: servicesLogsLoading,
    syncMutation: servicesSyncMutation,
    servicios,
    serviciosLoading,
    serviciosCount,
    activeFranchisees,
  } = useOrquestServicesSync();

  const [syncType, setSyncType] = useState<'employees' | 'schedules' | 'absences' | 'full'>('full');
  const [daysBack, setDaysBack] = useState('7');
  const [selectedCentro, setSelectedCentro] = useState<string>('all');
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [franchiseeFilter, setFranchiseeFilter] = useState('all');

  // Fetch centres for operational sync
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

  // Fetch operational sync logs
  const { data: operationalLogs, isLoading: operationalLogsLoading } = useQuery({
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
    refetchInterval: 10000,
  });

  // Execute operational sync
  const executeOperationalSync = useMutation({
    mutationFn: async (params: { sync_type: string; days_back?: number; centro_code?: string }) => {
      const { data, error } = await supabase.functions.invoke('sync_orquest', {
        body: params,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Sincronización de datos operativos iniciada');
      queryClient.invalidateQueries({ queryKey: ['sync_logs'] });
    },
    onError: (error: any) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  // Fetch franchisees for filter
  const { data: franchisees = [] } = useQuery({
    queryKey: ['franchisees'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('franchisees')
        .select('id, name')
        .order('name');

      if (error) throw error;
      return data;
    },
  });

  const handleExecuteOperationalSync = () => {
    const params: any = {
      sync_type: syncType,
      days_back: parseInt(daysBack),
    };
    
    if (selectedCentro !== 'all') {
      params.centro_code = selectedCentro;
    }

    executeOperationalSync.mutate(params);
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

  const filteredServicios = servicios?.filter(servicio => {
    const matchesSearch = !searchQuery || 
      servicio.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      servicio.nombre.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesFranchisee = franchiseeFilter === 'all' || servicio.franchisee_id === franchiseeFilter;
    
    return matchesSearch && matchesFranchisee;
  });

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="animate-spin h-8 w-8" />
      </div>
    );
  }

  if (!isAdmin) return null;

  const lastServicesSync = servicesLogs?.[0];
  const lastOperationalSync = operationalLogs?.[0];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <RefreshCw className="h-8 w-8" />
        <div>
          <h1 className="text-3xl font-bold">Sincronización con Orquest</h1>
          <p className="text-muted-foreground">Gestiona todas las sincronizaciones de datos</p>
        </div>
      </div>

      {/* Statistics Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Última Sync Servicios</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {lastServicesSync ? new Date(lastServicesSync.started_at).toLocaleDateString('es-ES') : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {lastServicesSync ? new Date(lastServicesSync.started_at).toLocaleTimeString('es-ES') : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Servicios</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{serviciosCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Sincronizados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Franquiciados Activos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeFranchisees}</div>
            <p className="text-xs text-muted-foreground mt-1">Con API Key</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Estado Sistema</CardTitle>
          </CardHeader>
          <CardContent>
            {lastServicesSync && getStatusBadge(lastServicesSync.status)}
          </CardContent>
        </Card>
      </div>

      {/* Services Sync Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Sincronizar Servicios (Restaurantes)
          </CardTitle>
          <CardDescription>
            Sincroniza la lista de servicios/restaurantes desde Orquest a la tabla servicios_orquest
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={() => servicesSyncMutation.mutate()}
            disabled={servicesSyncMutation.isPending}
          >
            {servicesSyncMutation.isPending ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Sincronizando...
              </>
            ) : (
              <>
                <Building2 className="mr-2 h-4 w-4" />
                Sincronizar Servicios Ahora
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Operational Sync Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Sincronizar Datos Operativos
          </CardTitle>
          <CardDescription>
            Sincroniza empleados, horarios y ausencias desde Orquest
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
              <Label htmlFor="syncType">Tipo</Label>
              <Select value={syncType} onValueChange={(val: any) => setSyncType(val)}>
                <SelectTrigger id="syncType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Completo</SelectItem>
                  <SelectItem value="employees">Solo Empleados</SelectItem>
                  <SelectItem value="schedules">Solo Horarios</SelectItem>
                  <SelectItem value="absences">Solo Ausencias</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="daysBack">Días atrás</Label>
              <Input
                id="daysBack"
                type="number"
                min="1"
                max="90"
                value={daysBack}
                onChange={(e) => setDaysBack(e.target.value)}
              />
            </div>

            <div className="flex items-end">
              <Button 
                onClick={handleExecuteOperationalSync} 
                disabled={executeOperationalSync.isPending}
                className="w-full"
              >
                {executeOperationalSync.isPending ? (
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

      {/* Unified History */}
      <Card>
        <CardHeader>
          <CardTitle>Historial de Sincronizaciones</CardTitle>
          <CardDescription>Logs de todas las sincronizaciones</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="servicios">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="servicios">Servicios</TabsTrigger>
              <TabsTrigger value="operativos">Datos Operativos</TabsTrigger>
            </TabsList>

            <TabsContent value="servicios" className="mt-4">
              {servicesLogsLoading ? (
                <div className="flex justify-center py-8">
                  <RefreshCw className="animate-spin h-8 w-8" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha/Hora</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Franquiciados</TableHead>
                      <TableHead className="text-right">Servicios</TableHead>
                      <TableHead className="text-right">Errores</TableHead>
                      <TableHead>Origen</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {servicesLogs?.map((log) => (
                      <>
                        <TableRow key={log.id}>
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
                          <TableCell>{getStatusBadge(log.status)}</TableCell>
                          <TableCell className="text-right">{log.total_franchisees}</TableCell>
                          <TableCell className="text-right">{log.total_services}</TableCell>
                          <TableCell className="text-right">
                            {log.franchisees_failed > 0 ? (
                              <span className="text-destructive font-medium">{log.franchisees_failed}</span>
                            ) : (
                              0
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {log.trigger_source === 'cron' ? 'Automático' : 'Manual'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {log.franchisees_failed > 0 && (
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
                            <TableCell colSpan={7} className="bg-muted/30">
                              <div className="p-4 space-y-2">
                                <h4 className="font-semibold text-sm">Detalles de Errores:</h4>
                                <div className="space-y-1 max-h-60 overflow-y-auto">
                                  {log.errors.map((error: any, idx: number) => (
                                    <div key={idx} className="text-xs bg-destructive/10 p-2 rounded">
                                      <span className="font-medium">{error.franchisee}</span>
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
            </TabsContent>

            <TabsContent value="operativos" className="mt-4">
              {operationalLogsLoading ? (
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {operationalLogs?.map((log) => (
                      <TableRow key={log.id}>
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
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Servicios View */}
      <Card>
        <CardHeader>
          <CardTitle>Servicios Sincronizados</CardTitle>
          <CardDescription>Explora los servicios disponibles en servicios_orquest</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por ID o nombre..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <Select value={franchiseeFilter} onValueChange={setFranchiseeFilter}>
                <SelectTrigger className="w-[250px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los franquiciados</SelectItem>
                  {franchisees.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {serviciosLoading ? (
              <div className="flex justify-center py-8">
                <RefreshCw className="animate-spin h-8 w-8" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Zona Horaria</TableHead>
                    <TableHead>Franquiciado</TableHead>
                    <TableHead>Última Actualización</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredServicios?.map((servicio) => (
                    <TableRow key={servicio.id}>
                      <TableCell className="font-mono text-xs">{servicio.id}</TableCell>
                      <TableCell>{servicio.nombre}</TableCell>
                      <TableCell>{servicio.zona_horaria || 'N/A'}</TableCell>
                      <TableCell>{servicio.franchisees?.name || 'N/A'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(servicio.updated_at).toLocaleString('es-ES')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Secrets Configuration */}
      <Accordion type="single" collapsible>
        <AccordionItem value="secrets">
          <AccordionTrigger className="text-sm font-medium">
            ⚙️ Configuración de Secrets
          </AccordionTrigger>
          <AccordionContent>
            <Card>
              <CardContent className="pt-6 space-y-3 text-sm">
                <p className="text-muted-foreground mb-4">
                  Los siguientes secrets deben estar configurados en Supabase para el funcionamiento óptimo:
                </p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                    <span className="font-medium">ORQUEST_BASE_URL</span>
                    <span className="text-xs text-muted-foreground">Base URL de la API de Orquest</span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                    <span className="font-medium">ORQUEST_BUSINESS_ID</span>
                    <span className="text-xs text-muted-foreground">ID del negocio (ej: MCDONALDS_ES)</span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                    <span className="font-medium">ALLOWED_ORIGINS</span>
                    <span className="text-xs text-muted-foreground">Orígenes permitidos (CSV)</span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                    <span className="font-medium">UPSERT_CHUNK_SIZE</span>
                    <span className="text-xs text-muted-foreground">Tamaño de lote para upserts</span>
                  </div>
                </div>
                <Button 
                  variant="link" 
                  className="mt-4 p-0"
                  onClick={() => window.open('https://supabase.com/dashboard/project/srwnjnrhxzcpftmbbyib/settings/functions', '_blank')}
                >
                  Configurar en Supabase Dashboard →
                </Button>
              </CardContent>
            </Card>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Info */}
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
                El sistema ejecuta automáticamente sincronizaciones diarias a las 03:00 UTC mediante pg_cron.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Activity className="h-4 w-4 mt-0.5 text-muted-foreground" />
            <div>
              <p className="font-medium">Robustez</p>
              <p className="text-muted-foreground">
                Las sincronizaciones incluyen reintentos automáticos, respeto de rate limits y procesamiento por lotes.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
