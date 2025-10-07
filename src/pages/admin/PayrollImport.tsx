import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ArrowLeft,
  Upload,
  FileSpreadsheet,
  Download,
  Save,
  Loader2,
  CheckCircle,
  AlertTriangle,
  X,
  FileText
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface ColumnMapping {
  sourceColumn: string;
  targetField: string;
}

interface MappingProfile {
  id: string;
  profile_name: string;
  column_mappings: Record<string, string>;
  file_type: string;
}

interface PreviewRow {
  [key: string]: any;
  _validation?: {
    isValid: boolean;
    errors: string[];
  };
}

interface ImportError {
  row: number;
  errors: string[];
  data: any;
}

const REQUIRED_FIELDS = [
  { key: "employee_id", label: "ID Empleado", type: "string" },
  { key: "periodo_inicio", label: "Periodo Inicio", type: "date" },
  { key: "periodo_fin", label: "Periodo Fin", type: "date" },
];

const OPTIONAL_FIELDS = [
  { key: "horas_trabajadas", label: "Horas Trabajadas", type: "number" },
  { key: "horas_vacaciones", label: "Horas Vacaciones", type: "number" },
  { key: "horas_formacion", label: "Horas Formación", type: "number" },
  { key: "coste_total", label: "Coste Total", type: "number" },
];

const PayrollImport = () => {
  const navigate = useNavigate();
  const { isAdmin, userId, loading: roleLoading } = useUserRole();
  
  const [step, setStep] = useState<"upload" | "mapping" | "preview" | "importing">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [rawData, setRawData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [previewData, setPreviewData] = useState<PreviewRow[]>([]);
  const [validationErrors, setValidationErrors] = useState<ImportError[]>([]);
  
  const [profiles, setProfiles] = useState<MappingProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<string>("");
  const [newProfileName, setNewProfileName] = useState("");
  const [showSaveProfile, setShowSaveProfile] = useState(false);
  
  const [importProgress, setImportProgress] = useState(0);
  const [importStats, setImportStats] = useState({ loaded: 0, skipped: 0, errors: 0 });

  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      toast.error("No tienes permisos para acceder a esta página");
      navigate("/dashboard");
    }
  }, [isAdmin, roleLoading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchProfiles();
    }
  }, [isAdmin]);

  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from("import_mapping_profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProfiles((data || []).map(p => ({
        ...p,
        column_mappings: p.column_mappings as Record<string, string>
      })));
    } catch (error: any) {
      console.error("Error fetching profiles:", error);
    }
  };

  const onDrop = async (acceptedFiles: File[]) => {
    const uploadedFile = acceptedFiles[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);

    try {
      const data = await uploadedFile.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet, { defval: "" });

      if (jsonData.length === 0) {
        toast.error("El archivo está vacío");
        return;
      }

      setRawData(jsonData);
      setHeaders(Object.keys(jsonData[0] as any));
      
      // Auto-detect columns
      autoDetectColumns(Object.keys(jsonData[0] as any));
      
      setStep("mapping");
      toast.success(`Archivo cargado: ${jsonData.length} filas detectadas`);
    } catch (error: any) {
      console.error("Error parsing file:", error);
      toast.error("Error al procesar el archivo: " + error.message);
    }
  };

  const autoDetectColumns = (headers: string[]) => {
    const mapping: Record<string, string> = {};
    const lowerHeaders = headers.map(h => h.toLowerCase());

    // Auto-detect common patterns
    const patterns = {
      employee_id: ["empleado", "id", "trabajador", "codtrabajador"],
      periodo_inicio: ["inicio", "fecha_inicio", "desde", "start"],
      periodo_fin: ["fin", "fecha_fin", "hasta", "end"],
      horas_trabajadas: ["horas_trabajadas", "trabajadas", "horas"],
      horas_vacaciones: ["vacaciones", "vacation", "holidays"],
      horas_formacion: ["formacion", "formación", "training"],
      coste_total: ["coste", "cost", "total", "importe"],
    };

    Object.entries(patterns).forEach(([field, keywords]) => {
      const matchedHeader = headers.find((header, idx) =>
        keywords.some(keyword => lowerHeaders[idx].includes(keyword))
      );
      if (matchedHeader) {
        mapping[field] = matchedHeader;
      }
    });

    setColumnMapping(mapping);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.ms-excel": [".xls"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "text/csv": [".csv"],
    },
    maxFiles: 1,
  });

  const handleMappingChange = (targetField: string, sourceColumn: string) => {
    setColumnMapping(prev => ({ ...prev, [targetField]: sourceColumn }));
  };

  const loadProfile = (profileId: string) => {
    const profile = profiles.find(p => p.id === profileId);
    if (profile) {
      setColumnMapping(profile.column_mappings);
      setSelectedProfile(profileId);
      toast.success("Perfil de mapeo cargado");
    }
  };

  const saveProfile = async () => {
    if (!newProfileName.trim()) {
      toast.error("Por favor ingresa un nombre para el perfil");
      return;
    }

    try {
      const { error } = await supabase
        .from("import_mapping_profiles")
        .insert({
          user_id: userId,
          profile_name: newProfileName,
          column_mappings: columnMapping,
          file_type: file?.name.split(".").pop() || "unknown",
        });

      if (error) throw error;

      toast.success("Perfil guardado correctamente");
      setShowSaveProfile(false);
      setNewProfileName("");
      fetchProfiles();
    } catch (error: any) {
      console.error("Error saving profile:", error);
      toast.error("Error al guardar perfil: " + error.message);
    }
  };

  const validateAndPreview = () => {
    // Check required mappings
    const missingRequired = REQUIRED_FIELDS.filter(
      field => !columnMapping[field.key]
    );

    if (missingRequired.length > 0) {
      toast.error(
        `Faltan campos obligatorios: ${missingRequired.map(f => f.label).join(", ")}`
      );
      return;
    }

    // Map and validate data
    const mappedData: PreviewRow[] = rawData.slice(0, 50).map((row, idx) => {
      const mapped: any = {};
      const errors: string[] = [];

      // Map columns
      Object.entries(columnMapping).forEach(([targetField, sourceColumn]) => {
        mapped[targetField] = row[sourceColumn];
      });

      // Validate
      if (!mapped.employee_id) {
        errors.push("ID de empleado vacío");
      }

      if (!mapped.periodo_inicio || !mapped.periodo_fin) {
        errors.push("Periodo incompleto");
      }

      // Validate dates
      if (mapped.periodo_inicio && isNaN(Date.parse(mapped.periodo_inicio))) {
        errors.push("Fecha de inicio inválida");
      }
      if (mapped.periodo_fin && isNaN(Date.parse(mapped.periodo_fin))) {
        errors.push("Fecha de fin inválida");
      }

      // Validate numbers
      ["horas_trabajadas", "horas_vacaciones", "horas_formacion", "coste_total"].forEach(
        field => {
          if (mapped[field] !== undefined && mapped[field] !== "" && isNaN(Number(mapped[field]))) {
            errors.push(`${field} no es un número válido`);
          }
        }
      );

      mapped._validation = {
        isValid: errors.length === 0,
        errors,
      };

      return mapped;
    });

    setPreviewData(mappedData);
    
    const invalidRows = mappedData.filter(row => !row._validation?.isValid);
    if (invalidRows.length > 0) {
      toast.warning(
        `${invalidRows.length} fila(s) con errores en la previsualización. Revisa antes de importar.`
      );
    }

    setStep("preview");
  };

  const processImport = async () => {
    setStep("importing");
    setImportProgress(0);
    setImportStats({ loaded: 0, skipped: 0, errors: 0 });

    const errors: ImportError[] = [];
    const logId = crypto.randomUUID();

    try {
      // Create import log
      await supabase.from("import_logs").insert({
        id: logId,
        user_id: userId,
        file_name: file?.name || "unknown",
        file_type: file?.name.split(".").pop() || "unknown",
        total_rows: rawData.length,
        status: "processing",
      });

      // Get all employees for ID lookup
      const { data: employees } = await supabase.from("employees").select("id, employee_id_orquest, codtrabajador_a3nom");
      const employeeMap = new Map();
      employees?.forEach(emp => {
        if (emp.employee_id_orquest) employeeMap.set(emp.employee_id_orquest, emp.id);
        if (emp.codtrabajador_a3nom) employeeMap.set(emp.codtrabajador_a3nom, emp.id);
      });

      let loaded = 0;
      let skipped = 0;
      let errorCount = 0;

      // Process in batches
      const batchSize = 50;
      for (let i = 0; i < rawData.length; i += batchSize) {
        const batch = rawData.slice(i, i + batchSize);
        const payrollsToInsert = [];

        for (const [idx, row] of batch.entries()) {
          const rowNumber = i + idx + 1;

          try {
            const mapped: any = {};
            Object.entries(columnMapping).forEach(([targetField, sourceColumn]) => {
              mapped[targetField] = row[sourceColumn];
            });

            // Validate
            if (!mapped.employee_id || !mapped.periodo_inicio || !mapped.periodo_fin) {
              errors.push({
                row: rowNumber,
                errors: ["Campos obligatorios faltantes"],
                data: row,
              });
              skipped++;
              continue;
            }

            // Find employee UUID
            const employeeUuid = employeeMap.get(mapped.employee_id);
            if (!employeeUuid) {
              errors.push({
                row: rowNumber,
                errors: [`Empleado no encontrado: ${mapped.employee_id}`],
                data: row,
              });
              skipped++;
              continue;
            }

            // Prepare payroll data
            payrollsToInsert.push({
              employee_id: employeeUuid,
              periodo_inicio: mapped.periodo_inicio,
              periodo_fin: mapped.periodo_fin,
              horas_trabajadas: mapped.horas_trabajadas ? Number(mapped.horas_trabajadas) : null,
              horas_vacaciones: mapped.horas_vacaciones ? Number(mapped.horas_vacaciones) : null,
              horas_formacion: mapped.horas_formacion ? Number(mapped.horas_formacion) : null,
              coste_total: mapped.coste_total ? Number(mapped.coste_total) : null,
            });

            loaded++;
          } catch (error: any) {
            errors.push({
              row: rowNumber,
              errors: [error.message],
              data: row,
            });
            errorCount++;
          }
        }

        // Insert batch
        if (payrollsToInsert.length > 0) {
          const { error: insertError } = await supabase
            .from("payrolls")
            .insert(payrollsToInsert);

          if (insertError) {
            console.error("Batch insert error:", insertError);
            errorCount += payrollsToInsert.length;
            loaded -= payrollsToInsert.length;
          }
        }

        // Update progress
        setImportProgress(Math.round(((i + batch.length) / rawData.length) * 100));
        setImportStats({ loaded, skipped, errors: errorCount });
      }

      // Update import log
      await supabase.from("import_logs").update({
        loaded_rows: loaded,
        skipped_rows: skipped,
        error_rows: errorCount,
        error_details: errors.length > 0 ? (errors as any) : null,
        status: "completed",
      }).eq("id", logId);

      setValidationErrors(errors);

      if (loaded > 0) {
        toast.success(`Importación completada: ${loaded} registros cargados`);
      }
      if (skipped > 0 || errorCount > 0) {
        toast.warning(
          `${skipped} registros omitidos, ${errorCount} con errores. Descarga el log para más detalles.`
        );
      }
    } catch (error: any) {
      console.error("Import error:", error);
      toast.error("Error durante la importación: " + error.message);
      
      await supabase.from("import_logs").update({
        status: "failed",
        error_details: [{ error: error.message }] as any,
      }).eq("id", logId);
    }
  };

  const downloadErrorLog = () => {
    if (validationErrors.length === 0) {
      toast.info("No hay errores para descargar");
      return;
    }

    const headers = ["Fila", "Errores", "Datos"];
    const rows = validationErrors.map(err => [
      err.row,
      err.errors.join("; "),
      JSON.stringify(err.data),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `errores_importacion_${format(new Date(), "yyyyMMdd_HHmmss")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("Log de errores descargado");
  };

  const reset = () => {
    setStep("upload");
    setFile(null);
    setRawData([]);
    setHeaders([]);
    setColumnMapping({});
    setPreviewData([]);
    setValidationErrors([]);
    setImportProgress(0);
    setImportStats({ loaded: 0, skipped: 0, errors: 0 });
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
          <Button variant="ghost" size="icon" onClick={() => navigate("/costs")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Importar Nóminas</h1>
            <p className="text-muted-foreground mt-1">
              Carga archivos XLS/XLSX/CSV con datos de nóminas
            </p>
          </div>
        </div>

        {/* Progress Steps */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              {[
                { key: "upload", label: "Cargar Archivo", icon: Upload },
                { key: "mapping", label: "Mapear Columnas", icon: FileSpreadsheet },
                { key: "preview", label: "Previsualizar", icon: FileText },
                { key: "importing", label: "Importar", icon: CheckCircle },
              ].map((s, idx) => (
                <div key={s.key} className="flex items-center">
                  <div
                    className={`flex flex-col items-center ${
                      step === s.key ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                        step === s.key
                          ? "border-primary bg-primary/10"
                          : "border-muted"
                      }`}
                    >
                      <s.icon className="h-5 w-5" />
                    </div>
                    <span className="text-xs mt-2">{s.label}</span>
                  </div>
                  {idx < 3 && (
                    <div className="w-20 h-0.5 bg-muted mx-2" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Upload Step */}
        {step === "upload" && (
          <Card>
            <CardHeader>
              <CardTitle>Cargar Archivo de Nóminas</CardTitle>
              <CardDescription>
                Arrastra y suelta un archivo XLS, XLSX o CSV
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
                  isDragActive
                    ? "border-primary bg-primary/5"
                    : "border-muted hover:border-primary/50"
                }`}
              >
                <input {...getInputProps()} />
                <Upload className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                {isDragActive ? (
                  <p className="text-lg">Suelta el archivo aquí...</p>
                ) : (
                  <div>
                    <p className="text-lg mb-2">
                      Arrastra un archivo aquí o haz clic para seleccionar
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Formatos soportados: XLS, XLSX, CSV
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Mapping Step */}
        {step === "mapping" && (
          <>
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>Mapeo de Columnas</CardTitle>
                    <CardDescription>
                      Asigna las columnas del archivo a los campos de la base de datos
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Select value={selectedProfile} onValueChange={loadProfile}>
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Cargar perfil" />
                      </SelectTrigger>
                      <SelectContent>
                        {profiles.map(profile => (
                          <SelectItem key={profile.id} value={profile.id}>
                            {profile.profile_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" onClick={() => setShowSaveProfile(true)}>
                      <Save className="h-4 w-4 mr-2" />
                      Guardar Perfil
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Campos Obligatorios</AlertTitle>
                  <AlertDescription>
                    Los campos marcados con * son obligatorios para completar la importación
                  </AlertDescription>
                </Alert>

                <div className="space-y-3">
                  <h3 className="font-medium">Campos Obligatorios</h3>
                  {REQUIRED_FIELDS.map(field => (
                    <div key={field.key} className="grid grid-cols-2 gap-4 items-center">
                      <Label>{field.label} *</Label>
                      <Select
                        value={columnMapping[field.key] || ""}
                        onValueChange={value => handleMappingChange(field.key, value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar columna" />
                        </SelectTrigger>
                        <SelectContent>
                          {headers.map(header => (
                            <SelectItem key={header} value={header}>
                              {header}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>

                <div className="space-y-3 pt-4">
                  <h3 className="font-medium">Campos Opcionales</h3>
                  {OPTIONAL_FIELDS.map(field => (
                    <div key={field.key} className="grid grid-cols-2 gap-4 items-center">
                      <Label>{field.label}</Label>
                      <Select
                        value={columnMapping[field.key] || ""}
                        onValueChange={value => handleMappingChange(field.key, value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar columna" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Sin mapear</SelectItem>
                          {headers.map(header => (
                            <SelectItem key={header} value={header}>
                              {header}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={reset}>
                    Cancelar
                  </Button>
                  <Button onClick={validateAndPreview}>
                    Continuar a Previsualización
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Dialog open={showSaveProfile} onOpenChange={setShowSaveProfile}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Guardar Perfil de Mapeo</DialogTitle>
                  <DialogDescription>
                    Guarda este mapeo para reutilizarlo en futuras importaciones
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Nombre del Perfil</Label>
                    <Input
                      placeholder="Ej: Nóminas A3Nom"
                      value={newProfileName}
                      onChange={e => setNewProfileName(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowSaveProfile(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={saveProfile}>Guardar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}

        {/* Preview Step */}
        {step === "preview" && (
          <Card>
            <CardHeader>
              <CardTitle>Previsualización de Datos</CardTitle>
              <CardDescription>
                Primeras 50 filas con validación. Revisa antes de importar.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {previewData.filter(row => !row._validation?.isValid).length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Errores Detectados</AlertTitle>
                  <AlertDescription>
                    {previewData.filter(row => !row._validation?.isValid).length} fila(s) con errores de validación.
                    Revisa las filas marcadas en rojo.
                  </AlertDescription>
                </Alert>
              )}

              <div className="rounded-md border overflow-x-auto max-h-[600px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Estado</TableHead>
                      {[...REQUIRED_FIELDS, ...OPTIONAL_FIELDS]
                        .filter(f => columnMapping[f.key])
                        .map(field => (
                          <TableHead key={field.key}>{field.label}</TableHead>
                        ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.map((row, idx) => (
                      <TableRow key={idx} className={!row._validation?.isValid ? "bg-destructive/10" : ""}>
                        <TableCell>
                          {row._validation?.isValid ? (
                            <CheckCircle className="h-4 w-4 text-success" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-destructive" />
                          )}
                        </TableCell>
                        {[...REQUIRED_FIELDS, ...OPTIONAL_FIELDS]
                          .filter(f => columnMapping[f.key])
                          .map(field => (
                            <TableCell key={field.key}>
                              {row[field.key]?.toString() || "-"}
                            </TableCell>
                          ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setStep("mapping")}>
                  Volver al Mapeo
                </Button>
                <Button onClick={processImport}>
                  Iniciar Importación ({rawData.length} filas)
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Importing Step */}
        {step === "importing" && (
          <Card>
            <CardHeader>
              <CardTitle>Importando Datos</CardTitle>
              <CardDescription>
                Procesando {rawData.length} registros...
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progreso</span>
                  <span>{importProgress}%</span>
                </div>
                <Progress value={importProgress} />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Cargados</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-success">{importStats.loaded}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Omitidos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-warning">{importStats.skipped}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Errores</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-destructive">{importStats.errors}</div>
                  </CardContent>
                </Card>
              </div>

              {importProgress === 100 && (
                <div className="space-y-4">
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertTitle>Importación Completada</AlertTitle>
                    <AlertDescription>
                      Se procesaron {rawData.length} registros exitosamente.
                    </AlertDescription>
                  </Alert>

                  <div className="flex justify-end gap-2">
                    {validationErrors.length > 0 && (
                      <Button variant="outline" onClick={downloadErrorLog}>
                        <Download className="h-4 w-4 mr-2" />
                        Descargar Log de Errores
                      </Button>
                    )}
                    <Button onClick={reset}>Nueva Importación</Button>
                    <Button variant="outline" onClick={() => navigate("/costs")}>
                      Ir a Costes
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default PayrollImport;
