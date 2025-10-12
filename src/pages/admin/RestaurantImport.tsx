import { useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { 
  useFileImport, 
  useColumnMapping,
  FileUploadZone,
  ColumnMapper,
  ImportProgress,
  type Field
} from "@/features/imports";

interface ImportResult {
  total: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; field: string; message: string }>;
}

const REQUIRED_FIELDS = ["site_number", "nombre"];

const FIELD_ALIASES: Record<string, string[]> = {
  site_number: ["site_number", "site", "codigo", "code", "site_code"],
  nombre: ["name", "nombre", "restaurant_name", "nom", "restaurant"],
  direccion: ["address", "direccion", "addr", "direcció"],
  ciudad: ["city", "ciudad", "town", "localidad"],
  state: ["state", "provincia", "region", "estado"],
  pais: ["country", "pais", "país", "nation"],
  postal_code: ["postal_code", "zip", "cp", "codigo_postal", "postcode"],
  franchisee_name: ["franchisee_name", "franquiciado", "franchisee", "owner_name"],
  franchisee_email: ["franchisee_email", "email_franquiciado", "owner_email", "franchisee_mail"],
  company_tax_id: ["company_tax_id", "cif", "nif", "tax_id", "vat"],
  seating_capacity: ["seating_capacity", "capacidad", "asientos", "capacity"],
  square_meters: ["square_meters", "metros", "m2", "area", "surface"],
  opening_date: ["opening_date", "fecha_apertura", "apertura", "opening"],
};

const RESTAURANT_FIELDS: Field[] = [
  { key: "site_number", label: "Site Number", type: "text", required: true },
  { key: "nombre", label: "Nombre", type: "text", required: true },
  { key: "direccion", label: "Dirección", type: "text" },
  { key: "ciudad", label: "Ciudad", type: "text" },
  { key: "state", label: "Provincia/Estado", type: "text" },
  { key: "pais", label: "País", type: "text" },
  { key: "postal_code", label: "Código Postal", type: "text" },
  { key: "franchisee_name", label: "Franquiciado (Nombre)", type: "text" },
  { key: "franchisee_email", label: "Franquiciado (Email)", type: "email" },
  { key: "company_tax_id", label: "CIF/NIF", type: "text" },
  { key: "seating_capacity", label: "Capacidad (asientos)", type: "number" },
  { key: "square_meters", label: "Metros Cuadrados", type: "number" },
  { key: "opening_date", label: "Fecha Apertura", type: "date" },
];

export default function RestaurantImport() {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [importStrategy, setImportStrategy] = useState<"insert" | "upsert" | "skip">("upsert");
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [forceImport, setForceImport] = useState(false);

  const {
    step,
    rawData,
    headers,
    progress,
    stats,
    validationErrors,
    setStep,
    parseFile,
    validateData,
    updateProgress,
    updateStats,
    reset,
  } = useFileImport({
    onDataParsed: (data, headers) => {
      autoDetectMapping(headers);
    },
  });

  const {
    columnMapping,
    autoDetectMapping,
    updateMapping,
    validateMapping,
  } = useColumnMapping({
    fieldAliases: FIELD_ALIASES,
    requiredFields: REQUIRED_FIELDS,
  });

  const handleFileSelected = async (file: File) => {
    await parseFile(file);
    setStep("mapping");
  };

  const handleValidateData = () => {
    if (!validateMapping()) return;

    const errors = validateData(rawData, columnMapping, (row, index) => {
      const validationErrors: Array<{ row: number; field: string; message: string; value?: any; isCritical?: boolean }> = [];
      const mappedRow: Record<string, any> = {};

      // Map and sanitize data
      Object.entries(columnMapping).forEach(([csvCol, dbCol]) => {
        let value = row[csvCol];
        if (value === "#N/D" || value === "#N/A" || value === "N/A" || value === "" || value === null || value === undefined) {
          value = null;
        } else if (typeof value === "string") {
          value = value.trim();
          if (value === "") value = null;
        }
        mappedRow[dbCol] = value;
      });

      // Validate required fields
      REQUIRED_FIELDS.forEach((field) => {
        if (!mappedRow[field] || mappedRow[field] === null) {
          validationErrors.push({
            row: index + 1,
            field,
            message: `Campo requerido "${field}" está vacío`,
            value: mappedRow[field],
            isCritical: true,
          });
        }
      });

      // Validate email format (only if has value)
      if (mappedRow.franchisee_email && mappedRow.franchisee_email !== null) {
        const email = String(mappedRow.franchisee_email).trim();
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          validationErrors.push({
            row: index + 1,
            field: "franchisee_email",
            message: "Formato de email inválido",
            value: email,
            isCritical: false,
          });
        }
      }

      // Validate date format (only if has value)
      if (mappedRow.opening_date && mappedRow.opening_date !== null) {
        const dateStr = String(mappedRow.opening_date);
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) {
          validationErrors.push({
            row: index + 1,
            field: "opening_date",
            message: "Formato de fecha inválido",
            value: dateStr,
            isCritical: false,
          });
        }
      }

      return validationErrors;
    });

    const criticalErrors = errors.filter(e => e.isCritical);
    if (criticalErrors.length === 0) {
      setStep("preview");
      toast.success("Validación completada");
    } else {
      toast.error(`${criticalErrors.length} errores críticos encontrados`);
    }
  };

  const performImport = async () => {
    if (!validateMapping()) return;

    console.info("[RestaurantImport] Iniciando importación");
    setStep("importing");
    updateProgress(0, rawData.length);

    const result: ImportResult = {
      total: rawData.length,
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };

    try {
      // STEP 1: Extract and upsert unique franchisees
      const uniqueFranchiseesMap = new Map();
      rawData.forEach(row => {
        Object.entries(columnMapping).forEach(([csvCol, dbCol]) => {
          if (dbCol === 'franchisee_email' && row[csvCol]) {
            const email = String(row[csvCol]).trim().toLowerCase();
            const nameCol = Object.keys(columnMapping).find(k => columnMapping[k] === 'franchisee_name');
            const taxIdCol = Object.keys(columnMapping).find(k => columnMapping[k] === 'company_tax_id');
            
            if (!uniqueFranchiseesMap.has(email)) {
              uniqueFranchiseesMap.set(email, {
                email,
                name: nameCol && row[nameCol] ? String(row[nameCol]).trim() : email.split('@')[0],
                company_tax_id: taxIdCol && row[taxIdCol] ? String(row[taxIdCol]).trim() : null
              });
            }
          }
        });
      });

      const uniqueFranchisees = Array.from(uniqueFranchiseesMap.values());
      const franchiseeIdMap = new Map<string, string>();

      if (uniqueFranchisees.length > 0) {
        console.info('[RestaurantImport] Upserting franchisees:', uniqueFranchisees.length);
        
        const { data: franchisees, error: franchiseeError } = await supabase
          .from('franchisees')
          .upsert(uniqueFranchisees, { onConflict: 'email' })
          .select('id, email');

        if (franchiseeError) {
          console.error('[RestaurantImport] Error upserting franchisees:', franchiseeError);
          throw franchiseeError;
        }

        franchisees?.forEach(f => {
          franchiseeIdMap.set(f.email, f.id);
        });
      }

      // STEP 2: Process restaurants with franchisee_id
      console.info('[RestaurantImport] Processing restaurants');
      const batchSize = 50;
      const batches = Math.ceil(rawData.length / batchSize);

      for (let i = 0; i < batches; i++) {
        const batch = rawData.slice(i * batchSize, (i + 1) * batchSize);

        for (const [index, row] of batch.entries()) {
          const mappedRow: Record<string, any> = {};
          
          Object.entries(columnMapping).forEach(([csvCol, dbCol]) => {
            mappedRow[dbCol] = row[csvCol] || null;
          });

          const restaurantData: any = {
            name: mappedRow.nombre,
            site_number: mappedRow.site_number,
            address: mappedRow.direccion,
            city: mappedRow.ciudad,
            state: mappedRow.state,
            country: mappedRow.pais || "España",
            postal_code: mappedRow.postal_code,
            seating_capacity: mappedRow.seating_capacity,
            square_meters: mappedRow.square_meters,
            opening_date: mappedRow.opening_date,
            franchisee_id: mappedRow.franchisee_email 
              ? franchiseeIdMap.get(String(mappedRow.franchisee_email).trim().toLowerCase()) 
              : null
          };

          try {
            if (importStrategy === "insert") {
              const { error } = await supabase.from("centres").insert([restaurantData]);
              if (error) throw error;
              result.inserted++;
            } else if (importStrategy === "upsert") {
              const { data: existing } = await supabase
                .from("centres")
                .select("id")
                .eq("site_number", restaurantData.site_number)
                .maybeSingle();

              if (existing) {
                const { error } = await supabase
                  .from("centres")
                  .update(restaurantData)
                  .eq("id", existing.id);
                if (error) throw error;
                result.updated++;
              } else {
                const { error } = await supabase.from("centres").insert([restaurantData]);
                if (error) throw error;
                result.inserted++;
              }
            } else {
              const { data: existing } = await supabase
                .from("centres")
                .select("id")
                .eq("site_number", restaurantData.site_number)
                .maybeSingle();

              if (existing) {
                result.skipped++;
              } else {
                const { error } = await supabase.from("centres").insert([restaurantData]);
                if (error) throw error;
                result.inserted++;
              }
            }
          } catch (error: any) {
            result.errors.push({
              row: i * batchSize + index + 1,
              field: "general",
              message: error.message,
            });
          }
        }

        updateProgress((i + 1) * batchSize, rawData.length);
      }

      setImportResult(result);
      updateStats({ 
        loaded: result.inserted + result.updated,
        skipped: result.skipped,
        errors: result.errors.length 
      });
      setStep("complete");
      
      toast.success(`Importación completada: ${result.inserted} insertados, ${result.updated} actualizados`);
    } catch (error: any) {
      console.error('[RestaurantImport] Error:', error);
      toast.error(`Error: ${error.message}`);
      setStep("preview");
    }
  };

  if (roleLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <p>Cargando...</p>
        </div>
      </Layout>
    );
  }

  if (!isAdmin) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <p className="text-destructive">Acceso denegado. Solo administradores.</p>
        </div>
      </Layout>
    );
  }

  const criticalErrors = validationErrors.filter(e => e.isCritical);
  const minorErrors = validationErrors.filter(e => !e.isCritical);

  return (
    <Layout>
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Importar Restaurantes</h1>
          <p className="text-muted-foreground">
            Carga y procesa datos masivos de restaurantes desde CSV/Excel
          </p>
        </div>

        <Tabs value={step} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="upload">1. Cargar</TabsTrigger>
            <TabsTrigger value="mapping" disabled={step === "upload"}>2. Mapear</TabsTrigger>
            <TabsTrigger value="preview" disabled={step === "upload" || step === "mapping"}>3. Vista Previa</TabsTrigger>
            <TabsTrigger value="complete" disabled={step !== "complete"}>4. Resultado</TabsTrigger>
          </TabsList>

          <TabsContent value="upload">
            <FileUploadZone
              onFileSelected={handleFileSelected}
              title="Paso 1: Cargar Archivo"
              description="Arrastra o selecciona un archivo CSV/Excel con datos de restaurantes"
            />
          </TabsContent>

          <TabsContent value="mapping">
            <Card>
              <CardHeader>
                <CardTitle>Paso 2: Mapear Columnas</CardTitle>
                <CardDescription>
                  Vincula las columnas del CSV con los campos de la base de datos
                </CardDescription>
              </CardHeader>
              <CardContent>
                {Object.keys(columnMapping).length > 0 && (
                  <div className="mb-6 p-4 bg-primary/5 border border-primary/20 rounded-lg">
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-primary" />
                      Auto-detección Completada
                    </h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Se detectaron {Object.keys(columnMapping).length} columnas automáticamente
                    </p>
                  </div>
                )}

                <ColumnMapper
                  headers={headers}
                  fields={RESTAURANT_FIELDS}
                  mapping={columnMapping}
                  onMappingChange={updateMapping}
                />

                <div className="mt-8 flex justify-between">
                  <Button variant="outline" onClick={() => setStep("upload")}>
                    Volver
                  </Button>
                  <Button onClick={handleValidateData}>
                    Validar y Continuar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="preview">
            <Card>
              <CardHeader>
                <CardTitle>Paso 3: Vista Previa y Configuración</CardTitle>
                <CardDescription>
                  Revisa los datos y selecciona la estrategia de importación
                </CardDescription>
              </CardHeader>
              <CardContent>
                {validationErrors.length > 0 && (
                  <div className="mb-6 p-4 bg-destructive/10 rounded-lg">
                    <h3 className="font-semibold text-destructive mb-2 flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5" />
                      {criticalErrors.length} Errores Críticos, {minorErrors.length} Advertencias
                    </h3>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {validationErrors.slice(0, 10).map((error, idx) => (
                        <p key={idx} className="text-sm">
                          <Badge variant={error.isCritical ? "destructive" : "secondary"} className="mr-2">
                            {error.isCritical ? "CRÍTICO" : "Advertencia"}
                          </Badge>
                          Fila {error.row}, campo "{error.field}": {error.message}
                          {error.value && <span className="font-mono ml-2 text-muted-foreground">({String(error.value)})</span>}
                        </p>
                      ))}
                      {validationErrors.length > 10 && (
                        <p className="text-sm font-medium">
                          ... y {validationErrors.length - 10} errores más
                        </p>
                      )}
                    </div>
                    
                    {minorErrors.length > 0 && (
                      <div className="mt-4 flex items-center gap-3 p-3 bg-background rounded border">
                        <Switch
                          id="force-import"
                          checked={forceImport}
                          onCheckedChange={setForceImport}
                        />
                        <Label htmlFor="force-import" className="cursor-pointer">
                          Forzar importación ignorando advertencias
                        </Label>
                      </div>
                    )}
                  </div>
                )}

                <div className="mb-6">
                  <Label>Estrategia de Importación</Label>
                  <Select value={importStrategy} onValueChange={(v: any) => setImportStrategy(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="insert">INSERT - Solo nuevos registros</SelectItem>
                      <SelectItem value="upsert">UPSERT - Actualizar si existe</SelectItem>
                      <SelectItem value="skip">SKIP - Saltar duplicados</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Site Number</TableHead>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Ciudad</TableHead>
                        <TableHead>Franquiciado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rawData.slice(0, 20).map((row, idx) => {
                        const mappedRow: Record<string, any> = {};
                        Object.entries(columnMapping).forEach(([csvCol, dbCol]) => {
                          mappedRow[dbCol] = row[csvCol];
                        });

                        return (
                          <TableRow key={idx}>
                            <TableCell className="font-mono">{mappedRow.site_number}</TableCell>
                            <TableCell>{mappedRow.nombre}</TableCell>
                            <TableCell>{mappedRow.ciudad}</TableCell>
                            <TableCell>{mappedRow.franchisee_name}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                <p className="text-sm text-muted-foreground mt-2">
                  Mostrando 20 de {rawData.length} registros
                </p>

                <div className="mt-8 flex justify-between">
                  <Button variant="outline" onClick={() => setStep("mapping")}>
                    Volver
                  </Button>
                  <Button 
                    onClick={performImport} 
                    disabled={
                      criticalErrors.length > 0 ||
                      (minorErrors.length > 0 && !forceImport)
                    }
                  >
                    Iniciar Importación
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="importing">
            <ImportProgress 
              progress={progress}
              stats={stats}
              isComplete={false}
            />
          </TabsContent>

          <TabsContent value="complete">
            {importResult && (
              <Card>
                <CardHeader>
                  <CardTitle>Importación Completada</CardTitle>
                  <CardDescription>Resumen de la operación</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="text-center p-4 border rounded-lg">
                      <p className="text-2xl font-bold">{importResult.total}</p>
                      <p className="text-sm text-muted-foreground">Total</p>
                    </div>
                    <div className="text-center p-4 border rounded-lg bg-green-50 dark:bg-green-950">
                      <CheckCircle className="mx-auto h-8 w-8 mb-2 text-green-600" />
                      <p className="text-2xl font-bold text-green-600">{importResult.inserted}</p>
                      <p className="text-sm text-muted-foreground">Insertados</p>
                    </div>
                    <div className="text-center p-4 border rounded-lg bg-blue-50 dark:bg-blue-950">
                      <CheckCircle className="mx-auto h-8 w-8 mb-2 text-blue-600" />
                      <p className="text-2xl font-bold text-blue-600">{importResult.updated}</p>
                      <p className="text-sm text-muted-foreground">Actualizados</p>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <XCircle className="mx-auto h-8 w-8 mb-2 text-muted-foreground" />
                      <p className="text-2xl font-bold">{importResult.skipped}</p>
                      <p className="text-sm text-muted-foreground">Omitidos</p>
                    </div>
                  </div>

                  {importResult.errors.length > 0 && (
                    <div className="p-4 bg-destructive/10 rounded-lg">
                      <h3 className="font-semibold text-destructive mb-2">
                        {importResult.errors.length} Errores Durante la Importación
                      </h3>
                      <div className="max-h-48 overflow-y-auto space-y-1">
                        {importResult.errors.map((error, idx) => (
                          <p key={idx} className="text-sm">
                            Fila {error.row}: {error.message}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-8">
                    <Button onClick={reset}>Nueva Importación</Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
