import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, RefreshCw, CheckCircle, Download, Eye } from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";

type DQIssue = {
  id: string;
  tipo: string;
  severidad: "critica" | "alta" | "media" | "baja";
  employee_id: string | null;
  periodo_inicio: string;
  periodo_fin: string;
  centro: string | null;
  detalle: any;
  resuelto: boolean;
  resuelto_por: string | null;
  resuelto_at: string | null;
  created_at: string;
};

const severityColors = {
  critica: "destructive",
  alta: "default",
  media: "secondary",
  baja: "outline",
} as const;

const severityLabels = {
  critica: "🔴 Crítica",
  alta: "🟠 Alta",
  media: "🟡 Media",
  baja: "⚪ Baja",
};

const tipoLabels = {
  PLAN_SIN_REAL: "Horas planificadas sin nómina",
  REAL_SIN_PLAN: "Horas trabajadas sin planificación",
  COSTE_ATIPICO: "Coste/hora atípico",
  EMPLEADO_SIN_CENTRO: "Empleado sin centro",
};

export default function DataQuality() {
  const { isAdmin, isGestor, loading: roleLoading } = useUserRole();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedPeriod, setSelectedPeriod] = useState<string>("current-month");
  const [selectedCentro, setSelectedCentro] = useState<string>("all");
  const [selectedSeveridad, setSelectedSeveridad] = useState<string>("all");
  const [selectedEstado, setSelectedEstado] = useState<string>("pending");
  const [detailDialog, setDetailDialog] = useState<DQIssue | null>(null);

  // Calculate date range
  const getDateRange = () => {
    const now = new Date();
    switch (selectedPeriod) {
      case "current-month":
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case "last-month":
        const lastMonth = subMonths(now, 1);
        return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
      case "last-3-months":
        return { start: startOfMonth(subMonths(now, 2)), end: endOfMonth(now) };
      default:
        return { start: startOfMonth(now), end: endOfMonth(now) };
    }
  };

  const dateRange = getDateRange();

  // Fetch centros
  const { data: centros = [] } = useQuery({
    queryKey: ["centros"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_centros");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch DQ issues
  const { data: issues = [], isLoading, refetch } = useQuery({
    queryKey: ["dq-issues", selectedCentro, selectedSeveridad, selectedEstado, dateRange],
    queryFn: async () => {
      let query = supabase
        .from("dq_issues")
        .select("*")
        .gte("periodo_inicio", format(dateRange.start, "yyyy-MM-dd"))
        .lte("periodo_fin", format(dateRange.end, "yyyy-MM-dd"))
        .order("created_at", { ascending: false });

      if (selectedCentro !== "all") {
        query = query.eq("centro", selectedCentro);
      }

      if (selectedSeveridad !== "all") {
        query = query.eq("severidad", selectedSeveridad as "critica" | "alta" | "media" | "baja");
      }

      if (selectedEstado === "pending") {
        query = query.eq("resuelto", false);
      } else if (selectedEstado === "resolved") {
        query = query.eq("resuelto", true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as DQIssue[];
    },
    enabled: !roleLoading && (isAdmin || isGestor),
  });

  // Recalculate mutation
  const recalculateMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("detect_dq_issues", {
        p_start_date: format(dateRange.start, "yyyy-MM-dd"),
        p_end_date: format(dateRange.end, "yyyy-MM-dd"),
        p_centro: selectedCentro === "all" ? null : selectedCentro,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["dq-issues"] });
      toast({
        title: "Análisis completado",
        description: `Se detectaron ${data[0]?.issues_detected || 0} incidencias`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error al recalcular",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Resolve mutation
  const resolveMutation = useMutation({
    mutationFn: async (issueId: string) => {
      const { error } = await supabase
        .from("dq_issues")
        .update({
          resuelto: true,
          resuelto_at: new Date().toISOString(),
        })
        .eq("id", issueId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dq-issues"] });
      toast({ title: "Incidencia marcada como resuelta" });
    },
    onError: (error: any) => {
      toast({
        title: "Error al resolver",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Export to CSV
  const exportToCSV = () => {
    const headers = ["Tipo", "Severidad", "Centro", "Periodo", "Estado", "Detalle"];
    const rows = issues.map((issue) => [
      tipoLabels[issue.tipo as keyof typeof tipoLabels] || issue.tipo,
      issue.severidad,
      issue.centro || "N/A",
      `${format(new Date(issue.periodo_inicio), "dd/MM/yyyy")} - ${format(new Date(issue.periodo_fin), "dd/MM/yyyy")}`,
      issue.resuelto ? "Resuelto" : "Pendiente",
      JSON.stringify(issue.detalle),
    ]);

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `incidencias-calidad-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  const issuesByType = issues.reduce((acc, issue) => {
    const sev = issue.severidad as string;
    acc[sev] = (acc[sev] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (roleLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (!isAdmin && !isGestor) {
    return (
      <Layout>
        <div className="text-center py-12">
          <AlertTriangle className="h-12 w-12 mx-auto text-destructive mb-4" />
          <h2 className="text-2xl font-bold">Acceso Denegado</h2>
          <p className="text-muted-foreground">No tienes permisos para ver esta página</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-8 w-8" />
            Calidad de Datos
          </h1>
          <p className="text-muted-foreground">
            Monitorización de incidencias y anomalías en datos
          </p>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger>
                  <SelectValue placeholder="Periodo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current-month">Mes actual</SelectItem>
                  <SelectItem value="last-month">Mes anterior</SelectItem>
                  <SelectItem value="last-3-months">Últimos 3 meses</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedCentro} onValueChange={setSelectedCentro}>
                <SelectTrigger>
                  <SelectValue placeholder="Centro" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los centros</SelectItem>
                  {centros.map((centro: any) => (
                    <SelectItem key={centro.centro} value={centro.centro}>
                      {centro.centro}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedSeveridad} onValueChange={setSelectedSeveridad}>
                <SelectTrigger>
                  <SelectValue placeholder="Severidad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="critica">Crítica</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="media">Media</SelectItem>
                  <SelectItem value="baja">Baja</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedEstado} onValueChange={setSelectedEstado}>
                <SelectTrigger>
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendientes</SelectItem>
                  <SelectItem value="resolved">Resueltos</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex gap-2">
                <Button
                  onClick={() => recalculateMutation.mutate()}
                  disabled={recalculateMutation.isPending}
                  className="flex-1"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${recalculateMutation.isPending ? "animate-spin" : ""}`} />
                  Recalcular
                </Button>
                <Button onClick={exportToCSV} variant="outline" disabled={issues.length === 0}>
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-destructive">
                  {issuesByType.critica || 0}
                </div>
                <div className="text-sm text-muted-foreground">🔴 Críticas</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-orange-600">
                  {issuesByType.alta || 0}
                </div>
                <div className="text-sm text-muted-foreground">🟠 Altas</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-600">
                  {issuesByType.media || 0}
                </div>
                <div className="text-sm text-muted-foreground">🟡 Medias</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-600">
                  {issuesByType.baja || 0}
                </div>
                <div className="text-sm text-muted-foreground">⚪ Bajas</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Issues Table */}
        <Card>
          <CardHeader>
            <CardTitle>Incidencias Detectadas</CardTitle>
            <CardDescription>
              {issues.length} incidencia{issues.length !== 1 ? "s" : ""} encontrada{issues.length !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin" />
              </div>
            ) : issues.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No se encontraron incidencias para los filtros seleccionados
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Severidad</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Centro</TableHead>
                    <TableHead>Periodo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {issues.map((issue) => (
                    <TableRow key={issue.id}>
                      <TableCell>
                        <Badge variant={severityColors[issue.severidad]}>
                          {severityLabels[issue.severidad]}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {tipoLabels[issue.tipo as keyof typeof tipoLabels] || issue.tipo}
                      </TableCell>
                      <TableCell>{issue.centro || "N/A"}</TableCell>
                      <TableCell>
                        {format(new Date(issue.periodo_inicio), "dd/MM/yyyy", { locale: es })} -{" "}
                        {format(new Date(issue.periodo_fin), "dd/MM/yyyy", { locale: es })}
                      </TableCell>
                      <TableCell>
                        {issue.resuelto ? (
                          <Badge variant="outline" className="text-green-600">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Resuelto
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-orange-600">
                            Pendiente
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDetailDialog(issue)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {!issue.resuelto && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => resolveMutation.mutate(issue.id)}
                              disabled={resolveMutation.isPending}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Resolver
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Detail Dialog */}
        <Dialog open={!!detailDialog} onOpenChange={() => setDetailDialog(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Detalle de Incidencia</DialogTitle>
              <DialogDescription>
                {detailDialog && tipoLabels[detailDialog.tipo as keyof typeof tipoLabels]}
              </DialogDescription>
            </DialogHeader>
            {detailDialog && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Severidad</div>
                    <Badge variant={severityColors[detailDialog.severidad]}>
                      {severityLabels[detailDialog.severidad]}
                    </Badge>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Centro</div>
                    <div className="font-medium">{detailDialog.centro || "N/A"}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Periodo</div>
                    <div className="font-medium">
                      {format(new Date(detailDialog.periodo_inicio), "dd/MM/yyyy")} -{" "}
                      {format(new Date(detailDialog.periodo_fin), "dd/MM/yyyy")}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Estado</div>
                    <div className="font-medium">
                      {detailDialog.resuelto ? "Resuelto" : "Pendiente"}
                    </div>
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-2">Información Detallada</div>
                  <pre className="bg-muted p-4 rounded-lg overflow-auto text-xs">
                    {JSON.stringify(detailDialog.detalle, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
