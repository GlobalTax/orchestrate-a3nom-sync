import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useFileImport, useColumnMapping } from "@/features/imports";
import { FileUploadZone, ColumnMapper, ImportProgress } from "@/features/imports";
import Layout from "@/components/Layout";
import { PageHeader } from "@/components/common";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, Save, AlertTriangle, Building2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface MappingProfile {
  id: string;
  profile_name: string;
  column_mappings: Record<string, string>;
  file_type: string;
}

const FIELD_ALIASES = {
  employee_id: ["empleado", "id", "trabajador", "codtrabajador"],
  periodo_inicio: ["inicio", "fecha_inicio", "desde", "start"],
  periodo_fin: ["fin", "fecha_fin", "hasta", "end"],
  horas_trabajadas: ["horas_trabajadas", "trabajadas", "horas"],
  horas_vacaciones: ["vacaciones", "vacation", "holidays"],
  horas_formacion: ["formacion", "formación", "training"],
  coste_total: ["coste", "cost", "total", "importe"],
};

const FIELDS = [
  { key: "employee_id", label: "ID Empleado", type: "string", required: true },
  { key: "periodo_inicio", label: "Periodo Inicio", type: "date", required: true },
  { key: "periodo_fin", label: "Periodo Fin", type: "date", required: true },
  { key: "horas_trabajadas", label: "Horas Trabajadas", type: "number", required: false },
  { key: "horas_vacaciones", label: "Horas Vacaciones", type: "number", required: false },
  { key: "horas_formacion", label: "Horas Formación", type: "number", required: false },
  { key: "coste_total", label: "Coste Total", type: "number", required: false },
];

const PayrollImport = () => {
  const navigate = useNavigate();
  const { isAdmin, userId, loading: roleLoading } = useUserRole();
  const [selectedCentro, setSelectedCentro] = useState<string | null>(null);
  
  const fileImport = useFileImport({
    onDataParsed: (data, headers) => {
      columnMapping.autoDetectMapping(headers);
    },
  });

  const columnMapping = useColumnMapping({
    fieldAliases: FIELD_ALIASES,
    requiredFields: ["employee_id", "periodo_inicio", "periodo_fin"],
  });
  
  const [profiles, setProfiles] = useState<MappingProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<string>("");
  const [newProfileName, setNewProfileName] = useState("");
  const [showSaveProfile, setShowSaveProfile] = useState(false);

  // Fetch centres for restaurant selector
  const { data: centres = [] } = useQuery({
    queryKey: ["centres"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("centres")
        .select("id, codigo, nombre")
        .eq("activo", true)
        .order("nombre");
      
      if (error) throw error;
      return data as { id: string; codigo: string; nombre: string; }[];
    },
    enabled: isAdmin,
  });

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
        .eq("file_type", "payroll")
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

  const handleFileSelected = async (file: File) => {
    const result = await fileImport.parseFile(file);
    if (result) {
      fileImport.setStep("mapping");
    }
  };

  const loadProfile = (profileId: string) => {
    const profile = profiles.find(p => p.id === profileId);
    if (profile) {
      Object.entries(profile.column_mappings).forEach(([field, column]) => {
        columnMapping.updateMapping(field, column);
      });
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
          column_mappings: columnMapping.columnMapping,
          file_type: "payroll",
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
    if (!columnMapping.validateMapping()) return;

    fileImport.setStep("preview");
    toast.success("Datos listos para importar");
  };

  const processImport = async () => {
    fileImport.setStep("importing");
    fileImport.updateProgress(0, fileImport.rawData.length);
    fileImport.updateStats({ loaded: 0, skipped: 0, errors: 0 });

    const errors: any[] = [];
    const logId = crypto.randomUUID();

    try {
      // Create import log
      await supabase.from("import_logs").insert({
        id: logId,
        user_id: userId,
        file_name: fileImport.file?.name || "unknown",
        file_type: fileImport.file?.name.split(".").pop() || "unknown",
        total_rows: fileImport.rawData.length,
        status: "processing",
      });

      // Get all employees for ID lookup (filtered by centro if selected)
      let employeesQuery = supabase.from("employees").select("id, employee_id_orquest, codtrabajador_a3nom, centro");
      
      if (selectedCentro) {
        employeesQuery = employeesQuery.eq("centro", selectedCentro);
      }
      
      const { data: employees } = await employeesQuery;
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
      for (let i = 0; i < fileImport.rawData.length; i += batchSize) {
        const batch = fileImport.rawData.slice(i, i + batchSize);
        const payrollsToInsert = [];

        for (const [idx, row] of batch.entries()) {
          const rowNumber = i + idx + 1;

          try {
            const mapped: any = {};
            Object.entries(columnMapping.columnMapping).forEach(([targetField, sourceColumn]) => {
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
        fileImport.updateProgress(i + batch.length, fileImport.rawData.length);
        fileImport.updateStats({ loaded, skipped, errors: errorCount, total: fileImport.rawData.length });
      }

      // Update import log
      await supabase.from("import_logs").update({
        loaded_rows: loaded,
        skipped_rows: skipped,
        error_rows: errorCount,
        error_details: errors.length > 0 ? (errors as any) : null,
        status: "completed",
      }).eq("id", logId);

      fileImport.setStep("complete");

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
        <PageHeader
          title="Importar Nóminas"
          description="Carga archivos XLS/XLSX/CSV con datos de nóminas"
          showBackButton
          backTo="/costs"
        />

        {/* Upload Step */}
        {fileImport.step === "upload" && (
          <>
            {/* Restaurant selector */}
            <Card>
              <CardHeader>
                <CardTitle>Configuración</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Label htmlFor="centro-select">Restaurante de destino (opcional)</Label>
                <Select
                  value={selectedCentro || "all"}
                  onValueChange={(val) => setSelectedCentro(val === "all" ? null : val)}
                >
                  <SelectTrigger id="centro-select">
                    <Building2 className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Todos los restaurantes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los restaurantes</SelectItem>
                    {centres.map((centro) => (
                      <SelectItem key={centro.codigo} value={centro.codigo}>
                        {centro.nombre} ({centro.codigo})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Filtra los empleados durante la importación por restaurante
                </p>
              </CardContent>
            </Card>
            
            <FileUploadZone
              onFileSelected={handleFileSelected}
              title="Cargar Archivo de Nóminas"
              description="Arrastra y suelta un archivo XLS, XLSX o CSV"
            />
          </>
        )}

        {/* Mapping Step */}
        {fileImport.step === "mapping" && (
          <>
            <div className="flex justify-end gap-2 mb-4">
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

            <ColumnMapper
              headers={fileImport.headers}
              fields={FIELDS}
              mapping={columnMapping.columnMapping}
              onMappingChange={columnMapping.updateMapping}
            />

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={fileImport.reset}>
                Cancelar
              </Button>
              <Button onClick={validateAndPreview}>
                Continuar
              </Button>
            </div>

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
        {fileImport.step === "preview" && (
          <>
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Vista Previa</AlertTitle>
              <AlertDescription>
                Revisa los datos mapeados antes de importar ({fileImport.rawData.length} registros)
              </AlertDescription>
            </Alert>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => fileImport.setStep("mapping")}>
                Volver al Mapeo
              </Button>
              <Button onClick={processImport}>
                Iniciar Importación
              </Button>
            </div>
          </>
        )}

        {/* Importing/Complete Step */}
        {(fileImport.step === "importing" || fileImport.step === "complete") && (
          <>
            <ImportProgress
              progress={fileImport.progress}
              stats={fileImport.stats}
              isComplete={fileImport.step === "complete"}
            />

            {fileImport.step === "complete" && (
              <div className="flex justify-end gap-2">
                <Button onClick={fileImport.reset}>Nueva Importación</Button>
                <Button variant="outline" onClick={() => navigate("/costs")}>
                  Ir a Costes
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
};

export default PayrollImport;
