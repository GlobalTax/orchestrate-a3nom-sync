import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, RefreshCw, Download, Eye, Calendar } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface AuditLog {
  id: string;
  user_id: string | null;
  user_email: string | null;
  action: "INSERT" | "UPDATE" | "DELETE";
  table_name: string;
  row_id: string | null;
  old_data: any;
  new_data: any;
  diff: any;
  created_at: string;
}

const TABLE_NAMES = [
  { value: "all", label: "Todas las tablas" },
  { value: "employees", label: "Empleados" },
  { value: "schedules", label: "Planificación" },
  { value: "absences", label: "Ausencias" },
  { value: "payrolls", label: "Nóminas" },
  { value: "user_roles", label: "Roles de Usuario" },
  { value: "dq_issues", label: "Incidencias DQ" },
];

const ACTION_TYPES = [
  { value: "all", label: "Todas las acciones" },
  { value: "INSERT", label: "Crear" },
  { value: "UPDATE", label: "Actualizar" },
  { value: "DELETE", label: "Eliminar" },
];

export default function Audit() {
  const navigate = useNavigate();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Filters
  const [filterUser, setFilterUser] = useState("");
  const [filterTable, setFilterTable] = useState("all");
  const [filterAction, setFilterAction] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  // Statistics
  const [stats, setStats] = useState({
    totalEvents: 0,
    uniqueUsers: 0,
    uniqueTables: 0,
  });

  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      toast.error("Acceso denegado. Solo administradores.");
      navigate("/dashboard");
    }
  }, [isAdmin, roleLoading, navigate]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      // Apply filters
      if (filterUser) {
        query = query.ilike("user_email", `%${filterUser}%`);
      }
      if (filterTable !== "all") {
        query = query.eq("table_name", filterTable);
      }
      if (filterAction !== "all") {
        query = query.eq("action", filterAction as "INSERT" | "UPDATE" | "DELETE");
      }
      if (filterDateFrom) {
        query = query.gte("created_at", new Date(filterDateFrom).toISOString());
      }
      if (filterDateTo) {
        query = query.lte("created_at", new Date(filterDateTo + "T23:59:59").toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      setLogs(data || []);

      // Calculate statistics
      const uniqueUsers = new Set(data?.map(log => log.user_email).filter(Boolean)).size;
      const uniqueTables = new Set(data?.map(log => log.table_name)).size;
      setStats({
        totalEvents: data?.length || 0,
        uniqueUsers,
        uniqueTables,
      });
    } catch (error: any) {
      console.error("Error fetching audit logs:", error);
      toast.error("Error al cargar los logs de auditoría");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchLogs();
    }
  }, [isAdmin, filterUser, filterTable, filterAction, filterDateFrom, filterDateTo]);

  const getActionBadge = (action: string) => {
    const variants: Record<string, any> = {
      INSERT: { variant: "default", color: "bg-green-500" },
      UPDATE: { variant: "secondary", color: "bg-blue-500" },
      DELETE: { variant: "destructive", color: "bg-red-500" },
    };
    return variants[action] || { variant: "outline", color: "bg-gray-500" };
  };

  const getTableLabel = (tableName: string) => {
    return TABLE_NAMES.find(t => t.value === tableName)?.label || tableName;
  };

  const exportToCSV = () => {
    const headers = ["Fecha", "Usuario", "Email", "Acción", "Tabla", "ID Registro"];
    const rows = logs.map(log => [
      format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss"),
      log.user_email || "Sistema",
      log.user_email || "-",
      log.action,
      getTableLabel(log.table_name),
      log.row_id || "-",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `audit_logs_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    toast.success("Logs exportados correctamente");
  };

  const handleViewDetail = (log: AuditLog) => {
    setSelectedLog(log);
    setDetailOpen(true);
  };

  if (roleLoading || !isAdmin) {
    return null;
  }

  return (
    <Layout>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <FileText className="h-8 w-8" />
              Auditoría del Sistema
            </h1>
            <p className="text-muted-foreground mt-1">
              Registro completo de cambios y trazabilidad
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={fetchLogs} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refrescar
            </Button>
            <Button onClick={exportToCSV} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total de Eventos</CardDescription>
              <CardTitle className="text-3xl">{stats.totalEvents}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Usuarios Únicos</CardDescription>
              <CardTitle className="text-3xl">{stats.uniqueUsers}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Tablas Afectadas</CardDescription>
              <CardTitle className="text-3xl">{stats.uniqueTables}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <Label htmlFor="filterUser">Usuario</Label>
                <Input
                  id="filterUser"
                  placeholder="Buscar por email..."
                  value={filterUser}
                  onChange={(e) => setFilterUser(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="filterTable">Tabla</Label>
                <Select value={filterTable} onValueChange={setFilterTable}>
                  <SelectTrigger id="filterTable">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TABLE_NAMES.map((table) => (
                      <SelectItem key={table.value} value={table.value}>
                        {table.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="filterAction">Acción</Label>
                <Select value={filterAction} onValueChange={setFilterAction}>
                  <SelectTrigger id="filterAction">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTION_TYPES.map((action) => (
                      <SelectItem key={action.value} value={action.value}>
                        {action.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="filterDateFrom">
                  <Calendar className="h-4 w-4 inline mr-1" />
                  Desde
                </Label>
                <Input
                  id="filterDateFrom"
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="filterDateTo">
                  <Calendar className="h-4 w-4 inline mr-1" />
                  Hasta
                </Label>
                <Input
                  id="filterDateTo"
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Logs Table */}
        <Card>
          <CardHeader>
            <CardTitle>Registro de Eventos</CardTitle>
            <CardDescription>
              Mostrando los últimos 100 eventos que coinciden con los filtros
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Cargando logs...</div>
            ) : logs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No se encontraron logs con los filtros aplicados
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Acción</TableHead>
                    <TableHead>Tabla</TableHead>
                    <TableHead>ID Registro</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <div className="text-sm">
                          {format(new Date(log.created_at), "dd/MM/yyyy HH:mm")}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(log.created_at), {
                            addSuffix: true,
                            locale: es,
                          })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">
                          {log.user_email || "Sistema"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getActionBadge(log.action).variant}>
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium">
                          {getTableLabel(log.table_name)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {log.row_id?.substring(0, 8)}...
                        </code>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetail(log)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Detail Dialog */}
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Detalle del Cambio</DialogTitle>
              <DialogDescription>
                Información completa del evento de auditoría
              </DialogDescription>
            </DialogHeader>
            {selectedLog && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Usuario</Label>
                    <div className="text-sm font-medium mt-1">
                      {selectedLog.user_email || "Sistema"}
                    </div>
                  </div>
                  <div>
                    <Label>Fecha</Label>
                    <div className="text-sm font-medium mt-1">
                      {format(new Date(selectedLog.created_at), "dd/MM/yyyy HH:mm:ss")}
                    </div>
                  </div>
                  <div>
                    <Label>Tabla</Label>
                    <div className="text-sm font-medium mt-1">
                      {getTableLabel(selectedLog.table_name)}
                    </div>
                  </div>
                  <div>
                    <Label>Acción</Label>
                    <div className="mt-1">
                      <Badge variant={getActionBadge(selectedLog.action).variant}>
                        {selectedLog.action}
                      </Badge>
                    </div>
                  </div>
                  <div className="col-span-2">
                    <Label>ID Registro</Label>
                    <code className="block text-xs bg-muted px-2 py-1 rounded mt-1">
                      {selectedLog.row_id}
                    </code>
                  </div>
                </div>

                {selectedLog.action === "UPDATE" && selectedLog.diff && (
                  <div>
                    <Label className="text-base">Cambios Realizados</Label>
                    <div className="mt-2 space-y-2">
                      {Object.entries(selectedLog.diff).map(([key, value]: [string, any]) => (
                        <Card key={key}>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium">{key}</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            <div>
                              <Label className="text-xs text-muted-foreground">Antes:</Label>
                              <pre className="text-xs bg-red-50 dark:bg-red-950/20 p-2 rounded mt-1 border border-red-200 dark:border-red-900">
                                {JSON.stringify(value.old, null, 2)}
                              </pre>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Ahora:</Label>
                              <pre className="text-xs bg-green-50 dark:bg-green-950/20 p-2 rounded mt-1 border border-green-200 dark:border-green-900">
                                {JSON.stringify(value.new, null, 2)}
                              </pre>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {selectedLog.action === "INSERT" && selectedLog.new_data && (
                  <div>
                    <Label className="text-base">Datos Creados</Label>
                    <pre className="text-xs bg-muted p-4 rounded mt-2 overflow-x-auto">
                      {JSON.stringify(selectedLog.new_data, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedLog.action === "DELETE" && selectedLog.old_data && (
                  <div>
                    <Label className="text-base">Datos Eliminados</Label>
                    <pre className="text-xs bg-muted p-4 rounded mt-2 overflow-x-auto">
                      {JSON.stringify(selectedLog.old_data, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
