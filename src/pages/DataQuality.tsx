import { useState, useMemo } from "react";
import { useUserRole } from "@/hooks/useUserRole";
import { useCentro } from "@/contexts/CentroContext";
import { useDataQualityIssues, useDataQualityMutations, DQIssue } from "@/hooks/useDataQuality";
import { ExportUtils } from "@/lib/exporters";
import { Formatters } from "@/lib/formatters";
import { PageHeader, LoadingSpinner, EmptyState } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, RefreshCw, CheckCircle, Download, Eye } from "lucide-react";
import { subMonths, startOfMonth, endOfMonth } from "date-fns";

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
  const { selectedCentro: globalCentro } = useCentro();

  const [selectedPeriod, setSelectedPeriod] = useState<string>("current-month");
  const [selectedSeveridad, setSelectedSeveridad] = useState<string>("all");
  const [selectedEstado, setSelectedEstado] = useState<"all" | "pending" | "resolved">("pending");
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

  const { issues, isLoading, refetch } = useDataQualityIssues({
    startDate: dateRange.start,
    endDate: dateRange.end,
    centro: globalCentro || undefined,
    severidad: selectedSeveridad,
    estado: selectedEstado,
  });

  const { recalculate, resolve } = useDataQualityMutations();

  // Export to CSV
  const exportToCSV = () => {
    ExportUtils.toCSV(
      issues,
      [
        { header: "Tipo", accessor: (row) => tipoLabels[row.tipo as keyof typeof tipoLabels] || row.tipo },
        { header: "Severidad", accessor: "severidad" },
        { header: "Centro", accessor: (row) => row.centro || "N/A" },
        {
          header: "Periodo",
          accessor: (row) =>
            `${Formatters.formatDate(row.periodo_inicio)} - ${Formatters.formatDate(row.periodo_fin)}`,
        },
        { header: "Estado", accessor: (row) => (row.resuelto ? "Resuelto" : "Pendiente") },
        { header: "Detalle", accessor: (row) => JSON.stringify(row.detalle) },
      ],
      `incidencias-calidad-${Formatters.formatDate(new Date(), "YYYY-MM-DD")}.csv`
    );
  };

  const issuesByType = useMemo(
    () =>
      issues.reduce((acc, issue) => {
        const sev = issue.severidad as string;
        acc[sev] = (acc[sev] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    [issues]
  );

  if (roleLoading) {
    return (
      <LoadingSpinner size="lg" />
    );
  }

  if (!isAdmin && !isGestor) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="h-12 w-12 mx-auto text-destructive mb-4" />
        <h2 className="text-2xl font-bold">Acceso Denegado</h2>
        <p className="text-muted-foreground">No tienes permisos para ver esta página</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
        <PageHeader
          title="Calidad de Datos"
          description="Monitorización de incidencias y anomalías en datos"
        />

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

              <Select value={selectedEstado} onValueChange={(value) => setSelectedEstado(value as "all" | "pending" | "resolved")}>
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
                  onClick={() => recalculate.mutate({ startDate: dateRange.start, endDate: dateRange.end, centro: globalCentro || undefined })}
                  disabled={recalculate.isPending}
                  className="flex-1"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${recalculate.isPending ? "animate-spin" : ""}`} />
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
              <LoadingSpinner />
            ) : issues.length === 0 ? (
              <EmptyState message="No se encontraron incidencias para los filtros seleccionados" />
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
                        {Formatters.formatDate(issue.periodo_inicio)} - {Formatters.formatDate(issue.periodo_fin)}
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
                              onClick={() => resolve.mutate(issue.id)}
                              disabled={resolve.isPending}
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
                      {Formatters.formatDate(detailDialog.periodo_inicio)} - {Formatters.formatDate(detailDialog.periodo_fin)}
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
  );
}
