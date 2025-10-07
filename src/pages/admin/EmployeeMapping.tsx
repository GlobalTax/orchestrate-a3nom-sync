import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  ArrowLeft, 
  Download, 
  Upload, 
  Save, 
  AlertTriangle, 
  CheckCircle, 
  Loader2,
  Link2,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Employee {
  id: string;
  nombre: string;
  apellidos: string;
  centro: string | null;
  employee_id_orquest: string | null;
  codtrabajador_a3nom: string | null;
}

interface MappingRow {
  id: string;
  nombre: string;
  apellidos: string;
  centro: string | null;
  employee_id_orquest: string | null;
  codtrabajador_a3nom: string | null;
  newOrquestId?: string;
  newA3NomCode?: string;
  hasChanges: boolean;
  hasIssue: boolean;
  issueType?: "missing_orquest" | "missing_a3nom" | "both_missing";
}

const EmployeeMapping = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [mappingRows, setMappingRows] = useState<MappingRow[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "missing_orquest" | "missing_a3nom" | "complete">("all");
  
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      toast.error("No tienes permisos para acceder a esta página");
      navigate("/dashboard");
    }
  }, [isAdmin, roleLoading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchEmployees();
    }
  }, [isAdmin]);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .order("apellidos", { ascending: true });

      if (error) throw error;

      setEmployees(data || []);
      
      // Create mapping rows with issue detection
      const rows: MappingRow[] = (data || []).map((emp) => {
        const missingOrquest = !emp.employee_id_orquest;
        const missingA3Nom = !emp.codtrabajador_a3nom;
        
        let issueType: MappingRow["issueType"] = undefined;
        if (missingOrquest && missingA3Nom) {
          issueType = "both_missing";
        } else if (missingOrquest) {
          issueType = "missing_orquest";
        } else if (missingA3Nom) {
          issueType = "missing_a3nom";
        }

        return {
          id: emp.id,
          nombre: emp.nombre,
          apellidos: emp.apellidos,
          centro: emp.centro,
          employee_id_orquest: emp.employee_id_orquest,
          codtrabajador_a3nom: emp.codtrabajador_a3nom,
          hasChanges: false,
          hasIssue: missingOrquest || missingA3Nom,
          issueType,
        };
      });

      setMappingRows(rows);
    } catch (error: any) {
      console.error("Error fetching employees:", error);
      toast.error("Error al cargar empleados: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOrquestIdChange = (rowId: string, value: string) => {
    setMappingRows((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? { ...row, newOrquestId: value, hasChanges: true }
          : row
      )
    );
  };

  const handleA3NomCodeChange = (rowId: string, value: string) => {
    setMappingRows((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? { ...row, newA3NomCode: value, hasChanges: true }
          : row
      )
    );
  };

  const validateMappings = (): boolean => {
    const errors: string[] = [];
    const orquestIds = new Set<string>();
    const a3nomCodes = new Set<string>();

    mappingRows.forEach((row) => {
      const orquestId = row.newOrquestId || row.employee_id_orquest;
      const a3nomCode = row.newA3NomCode || row.codtrabajador_a3nom;

      if (orquestId) {
        if (orquestIds.has(orquestId)) {
          errors.push(`ID Orquest duplicado: ${orquestId}`);
        }
        orquestIds.add(orquestId);
      }

      if (a3nomCode) {
        if (a3nomCodes.has(a3nomCode)) {
          errors.push(`Código A3Nom duplicado: ${a3nomCode}`);
        }
        a3nomCodes.add(a3nomCode);
      }
    });

    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handleSave = async () => {
    if (!validateMappings()) {
      toast.error("Hay errores de validación. Por favor, corrígelos antes de guardar.");
      return;
    }

    try {
      setSaving(true);

      const updates = mappingRows
        .filter((row) => row.hasChanges)
        .map((row) => ({
          id: row.id,
          employee_id_orquest: row.newOrquestId || row.employee_id_orquest,
          codtrabajador_a3nom: row.newA3NomCode || row.codtrabajador_a3nom,
        }));

      if (updates.length === 0) {
        toast.info("No hay cambios para guardar");
        return;
      }

      // Update each employee
      for (const update of updates) {
        const { error } = await supabase
          .from("employees")
          .update({
            employee_id_orquest: update.employee_id_orquest,
            codtrabajador_a3nom: update.codtrabajador_a3nom,
          })
          .eq("id", update.id);

        if (error) throw error;
      }

      toast.success(`${updates.length} mapeo(s) actualizado(s) correctamente`);
      await fetchEmployees();
    } catch (error: any) {
      console.error("Error saving mappings:", error);
      toast.error("Error al guardar mapeos: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const exportToCSV = () => {
    if (mappingRows.length === 0) {
      toast.error("No hay datos para exportar");
      return;
    }

    const headers = [
      "ID Empleado",
      "Nombre",
      "Apellidos",
      "Centro",
      "ID Orquest",
      "Código A3Nom"
    ];

    const rows = mappingRows.map((row) => [
      row.id,
      row.nombre,
      row.apellidos,
      row.centro || "",
      row.newOrquestId || row.employee_id_orquest || "",
      row.newA3NomCode || row.codtrabajador_a3nom || "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `mapeo_empleados_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("Mapeo exportado correctamente");
  };

  const handleImportCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const lines = text.split("\n").filter((line) => line.trim());
      
      if (lines.length < 2) {
        toast.error("El archivo CSV está vacío o no tiene el formato correcto");
        return;
      }

      // Skip header line
      const dataLines = lines.slice(1);
      let importCount = 0;

      for (const line of dataLines) {
        const values = line.split(",").map((v) => v.replace(/^"|"$/g, "").trim());
        
        if (values.length < 6) continue;

        const [employeeId, , , , orquestId, a3nomCode] = values;

        // Find the row and update it
        setMappingRows((prev) =>
          prev.map((row) => {
            if (row.id === employeeId) {
              importCount++;
              return {
                ...row,
                newOrquestId: orquestId || undefined,
                newA3NomCode: a3nomCode || undefined,
                hasChanges: true,
              };
            }
            return row;
          })
        );
      }

      toast.success(`${importCount} mapeo(s) importado(s). Recuerda guardar los cambios.`);
      
      // Reset file input
      event.target.value = "";
    } catch (error: any) {
      console.error("Error importing CSV:", error);
      toast.error("Error al importar CSV: " + error.message);
    }
  };

  const filteredRows = mappingRows.filter((row) => {
    const matchesSearch =
      row.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.apellidos.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.employee_id_orquest?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.codtrabajador_a3nom?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter =
      filterType === "all" ||
      (filterType === "missing_orquest" && !row.employee_id_orquest && !row.newOrquestId) ||
      (filterType === "missing_a3nom" && !row.codtrabajador_a3nom && !row.newA3NomCode) ||
      (filterType === "complete" && row.employee_id_orquest && row.codtrabajador_a3nom);

    return matchesSearch && matchesFilter;
  });

  const stats = {
    total: mappingRows.length,
    complete: mappingRows.filter((r) => r.employee_id_orquest && r.codtrabajador_a3nom).length,
    missingOrquest: mappingRows.filter((r) => !r.employee_id_orquest).length,
    missingA3Nom: mappingRows.filter((r) => !r.codtrabajador_a3nom).length,
    withChanges: mappingRows.filter((r) => r.hasChanges).length,
  };

  if (roleLoading || !isAdmin) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/admin/users")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Mapeo de IDs de Empleados</h1>
            <p className="text-muted-foreground mt-1">
              Concilia identificadores entre Orquest y A3Nom
            </p>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Empleados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Completos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{stats.complete}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Sin ID Orquest
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">{stats.missingOrquest}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Sin Código A3Nom
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">{stats.missingA3Nom}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Cambios Pendientes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{stats.withChanges}</div>
            </CardContent>
          </Card>
        </div>

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Errores de Validación</AlertTitle>
            <AlertDescription>
              <ul className="list-disc list-inside mt-2 space-y-1">
                {validationErrors.map((error, idx) => (
                  <li key={idx}>{error}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Actions Bar */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <CardTitle>Gestión de Mapeos</CardTitle>
                <CardDescription>
                  Asigna y corrige identificadores entre sistemas
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={exportToCSV} className="gap-2">
                  <Download className="h-4 w-4" />
                  Exportar CSV
                </Button>
                <label>
                  <Button variant="outline" className="gap-2" asChild>
                    <span>
                      <Upload className="h-4 w-4" />
                      Importar CSV
                    </span>
                  </Button>
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={handleImportCSV}
                  />
                </label>
                <Button 
                  onClick={handleSave} 
                  disabled={saving || stats.withChanges === 0}
                  className="gap-2"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Guardar Cambios
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                placeholder="Buscar por nombre, apellidos o IDs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1"
              />
              <Select value={filterType} onValueChange={(value: any) => setFilterType(value)}>
                <SelectTrigger className="w-full sm:w-[250px]">
                  <SelectValue placeholder="Filtrar por estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos ({mappingRows.length})</SelectItem>
                  <SelectItem value="complete">Completos ({stats.complete})</SelectItem>
                  <SelectItem value="missing_orquest">Sin ID Orquest ({stats.missingOrquest})</SelectItem>
                  <SelectItem value="missing_a3nom">Sin Código A3Nom ({stats.missingA3Nom})</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Mapping Table */}
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No se encontraron empleados con los filtros aplicados
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Estado</TableHead>
                      <TableHead>Empleado</TableHead>
                      <TableHead>Centro</TableHead>
                      <TableHead>ID Orquest</TableHead>
                      <TableHead>Código A3Nom</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.map((row) => (
                      <TableRow key={row.id} className={row.hasChanges ? "bg-primary/5" : ""}>
                        <TableCell>
                          {row.hasIssue ? (
                            <AlertCircle className="h-4 w-4 text-warning" />
                          ) : (
                            <CheckCircle className="h-4 w-4 text-success" />
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          <div>
                            <div>{row.nombre} {row.apellidos}</div>
                            {row.hasChanges && (
                              <Badge variant="outline" className="mt-1 text-xs">
                                Modificado
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {row.centro ? (
                            <Badge variant="outline">{row.centro}</Badge>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>
                          <Input
                            placeholder="ID Orquest"
                            defaultValue={row.employee_id_orquest || ""}
                            onChange={(e) => handleOrquestIdChange(row.id, e.target.value)}
                            className={cn(
                              "max-w-[200px]",
                              !row.employee_id_orquest && !row.newOrquestId && "border-warning"
                            )}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            placeholder="Código A3Nom"
                            defaultValue={row.codtrabajador_a3nom || ""}
                            onChange={(e) => handleA3NomCodeChange(row.id, e.target.value)}
                            className={cn(
                              "max-w-[200px]",
                              !row.codtrabajador_a3nom && !row.newA3NomCode && "border-warning"
                            )}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Instrucciones
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>1. <strong>Identificar discrepancias:</strong> Los empleados con campos vacíos se resaltan con un icono de advertencia.</p>
            <p>2. <strong>Asignar IDs:</strong> Completa manualmente los campos vacíos con los identificadores correctos.</p>
            <p>3. <strong>Validación:</strong> El sistema detecta automáticamente IDs duplicados antes de guardar.</p>
            <p>4. <strong>Import/Export:</strong> Usa CSV para gestionar mapeos masivos externamente.</p>
            <p>5. <strong>Guardar:</strong> Los cambios solo se aplicarán tras hacer clic en "Guardar Cambios".</p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default EmployeeMapping;
