import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import * as XLSX from "xlsx";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileSpreadsheet, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";

interface CsvRow {
  [key: string]: string | number | null;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
  value?: any;
  isCritical?: boolean;
}

interface ImportResult {
  total: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: ValidationError[];
}

const REQUIRED_FIELDS = ["site_number", "nombre"];

const COLUMN_MAPPING = {
  site_number: "site_number",
  name: "nombre",
  address: "direccion",
  city: "ciudad",
  state: "state",
  country: "pais",
  postal_code: "postal_code",
  franchisee_name: "franchisee_name",
  franchisee_email: "franchisee_email",
  company_tax_id: "company_tax_id",
  seating_capacity: "seating_capacity",
  square_meters: "square_meters",
  opening_date: "opening_date",
};

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

export default function RestaurantImport() {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [step, setStep] = useState(1);
  const [csvData, setCsvData] = useState<CsvRow[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [importStrategy, setImportStrategy] = useState<"insert" | "upsert" | "skip">("upsert");
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [forceImport, setForceImport] = useState(false);
  const [autoDetectedColumns, setAutoDetectedColumns] = useState<string[]>([]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    const reader = new FileReader();

    reader.onload = (e) => {
      const data = e.target?.result;
      const workbook = XLSX.read(data, { type: "binary" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(worksheet) as CsvRow[];

      setCsvData(json);
      
      // Auto-detectar mapeo de columnas con matching mejorado
      const firstRow = json[0];
      const detectedMapping: Record<string, string> = {};
      
      Object.keys(firstRow).forEach((csvCol) => {
        const normalizedCsvCol = csvCol.toLowerCase().trim().replace(/\s+/g, "_");
        
        Object.entries(FIELD_ALIASES).forEach(([dbField, aliases]) => {
          // Matching exacto primero (prioridad)
          if (aliases.includes(normalizedCsvCol) || aliases.includes(csvCol.toLowerCase().trim())) {
            detectedMapping[csvCol] = dbField;
            return;
          }
          
          // Matching parcial como fallback (solo si no hay mapping exacto)
          if (!detectedMapping[csvCol]) {
            const matchFound = aliases.some(alias => {
              const normalizedAlias = alias.toLowerCase().replace(/\s+/g, "_");
              return normalizedCsvCol.includes(normalizedAlias) || normalizedAlias.includes(normalizedCsvCol);
            });
            
            if (matchFound) {
              detectedMapping[csvCol] = dbField;
            }
          }
        });
      });
      
      console.log("Auto-detected mapping:", detectedMapping);
      console.log("CSV columns:", Object.keys(firstRow));
      setColumnMapping(detectedMapping);
      setAutoDetectedColumns(Object.keys(detectedMapping));
      setStep(2);
      toast.success(`Archivo cargado: ${json.length} registros`);
    };

    reader.readAsText(file, 'UTF-8');
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
      "application/vnd.ms-excel": [".xls"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
    },
    maxFiles: 1,
  });

  const validateData = () => {
    const errors: ValidationError[] = [];
    const seenSiteNumbers = new Set<string>();

    csvData.forEach((row, index) => {
      const mappedRow: Record<string, any> = {};
      
      // Sanitizar y mapear datos
      Object.entries(columnMapping).forEach(([csvCol, dbCol]) => {
        let value = row[csvCol];
        
        // Limpiar valores problemáticos
        if (value === "#N/D" || value === "#N/A" || value === "N/A" || value === "" || value === null || value === undefined) {
          value = null;
        } else if (typeof value === "string") {
          value = value.trim();
          if (value === "") {
            value = null;
          }
        }
        
        mappedRow[dbCol] = value;
      });

      // Validar solo campos requeridos (site_number y nombre)
      REQUIRED_FIELDS.forEach((field) => {
        if (!mappedRow[field] || mappedRow[field] === null) {
          errors.push({
            row: index + 1,
            field,
            message: `Campo requerido "${field}" está vacío`,
            value: mappedRow[field],
            isCritical: true,
          });
        }
      });

      // Validar site_number único
      if (mappedRow.site_number) {
        const siteNum = String(mappedRow.site_number).trim();
        if (seenSiteNumbers.has(siteNum)) {
          errors.push({
            row: index + 1,
            field: "site_number",
            message: `Número de sitio duplicado`,
            value: siteNum,
            isCritical: true,
          });
        }
        seenSiteNumbers.add(siteNum);
      }

      // Validar email format SOLO si tiene valor
      if (mappedRow.franchisee_email && mappedRow.franchisee_email !== null) {
        const email = String(mappedRow.franchisee_email).trim();
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          errors.push({
            row: index + 1,
            field: "franchisee_email",
            message: "Formato de email inválido",
            value: email,
            isCritical: false,
          });
        }
      }

      // Validar fecha SOLO si tiene valor
      if (mappedRow.opening_date && mappedRow.opening_date !== null) {
        const dateStr = String(mappedRow.opening_date);
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) {
          errors.push({
            row: index + 1,
            field: "opening_date",
            message: "Formato de fecha inválido",
            value: dateStr,
            isCritical: false,
          });
        }
      }
    });

    setValidationErrors(errors);
    
    const criticalErrors = errors.filter(e => e.isCritical);
    const minorErrors = errors.filter(e => !e.isCritical);
    
    if (errors.length === 0) {
      setStep(3);
      toast.success("Validación completada sin errores");
    } else {
      setStep(3);
      if (criticalErrors.length > 0) {
        toast.error(`${criticalErrors.length} errores críticos encontrados`);
      } else {
        toast.warning(`${minorErrors.length} advertencias encontradas (puedes forzar la importación)`);
      }
    }
  };

  const performImport = async () => {
    setImporting(true);
    setImportProgress(0);

    const result: ImportResult = {
      total: csvData.length,
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };

    const batchSize = 50;
    const batches = Math.ceil(csvData.length / batchSize);

    for (let i = 0; i < batches; i++) {
      const batch = csvData.slice(i * batchSize, (i + 1) * batchSize);

      for (const [index, row] of batch.entries()) {
        const mappedRow: Record<string, any> = {};
        
        Object.entries(columnMapping).forEach(([csvCol, dbCol]) => {
          mappedRow[dbCol] = row[csvCol] || null;
        });

        // Añadir código si no existe
        if (!mappedRow.codigo) {
          mappedRow.codigo = mappedRow.site_number || "";
        }

        // Asegurar que nombre existe
        if (!mappedRow.nombre) {
          mappedRow.nombre = mappedRow.nombre || `Restaurante ${mappedRow.site_number || ""}`;
        }

        // Default país
        if (!mappedRow.pais) {
          mappedRow.pais = "España";
        }

        try {
          if (importStrategy === "insert") {
            const { error } = await supabase.from("centres").insert([mappedRow as any]);
            if (error) throw error;
            result.inserted++;
          } else if (importStrategy === "upsert") {
            // Verificar si existe
            const { data: existing } = await supabase
              .from("centres")
              .select("id")
              .eq("site_number", mappedRow.site_number)
              .maybeSingle();

            if (existing) {
              const { error } = await supabase
                .from("centres")
                .update(mappedRow as any)
                .eq("id", existing.id);
              if (error) throw error;
              result.updated++;
            } else {
              const { error } = await supabase.from("centres").insert([mappedRow as any]);
              if (error) throw error;
              result.inserted++;
            }
          } else {
            // skip - verificar si existe
            const { data: existing } = await supabase
              .from("centres")
              .select("id")
              .eq("site_number", mappedRow.site_number)
              .maybeSingle();

            if (existing) {
              result.skipped++;
            } else {
              const { error } = await supabase.from("centres").insert([mappedRow as any]);
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

      setImportProgress(((i + 1) / batches) * 100);
    }

    setImportResult(result);
    setImporting(false);
    setStep(4);
    
    toast.success(`Importación completada: ${result.inserted} insertados, ${result.updated} actualizados`);
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

  return (
    <Layout>
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Importar Restaurantes desde CSV</h1>
          <p className="text-muted-foreground">
            Carga y procesa datos masivos de restaurantes
          </p>
        </div>

        <Tabs value={`step${step}`} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="step1">1. Cargar</TabsTrigger>
            <TabsTrigger value="step2" disabled={step < 2}>2. Mapear</TabsTrigger>
            <TabsTrigger value="step3" disabled={step < 3}>3. Vista Previa</TabsTrigger>
            <TabsTrigger value="step4" disabled={step < 4}>4. Resultado</TabsTrigger>
          </TabsList>

          <TabsContent value="step1">
            <Card>
              <CardHeader>
                <CardTitle>Paso 1: Cargar Archivo CSV</CardTitle>
                <CardDescription>
                  Arrastra o selecciona un archivo CSV/Excel con datos de restaurantes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
                    isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25"
                  }`}
                >
                  <input {...getInputProps()} />
                  <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  {isDragActive ? (
                    <p>Suelta el archivo aquí...</p>
                  ) : (
                    <>
                      <p className="text-lg mb-2">
                        Arrastra un archivo CSV aquí, o haz clic para seleccionar
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Formatos aceptados: .csv, .xls, .xlsx
                      </p>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="step2">
            <Card>
              <CardHeader>
                <CardTitle>Paso 2: Mapear Columnas</CardTitle>
                <CardDescription>
                  Vincula las columnas del CSV con los campos de la base de datos
                </CardDescription>
              </CardHeader>
              <CardContent>
                {autoDetectedColumns.length > 0 && (
                  <div className="mb-6 p-4 bg-primary/5 border border-primary/20 rounded-lg">
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-primary" />
                      Auto-detección Completada
                    </h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Se detectaron {autoDetectedColumns.length} columnas automáticamente
                    </p>
                    <div className="space-y-2">
                      <div className="font-medium text-sm">Mapeo aplicado:</div>
                      <div className="space-y-1 font-mono text-xs bg-background p-3 rounded border">
                        {Object.entries(columnMapping).map(([csv, db]) => (
                          <div key={csv} className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono">
                              {csv}
                            </Badge>
                            <span>→</span>
                            <Badge variant="secondary" className="font-mono">
                              {db}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  {csvData.length > 0 && Object.keys(csvData[0]).map((csvCol) => (
                    <div key={csvCol} className="flex items-center gap-4">
                      <Label className="w-48 font-mono text-sm">{csvCol}</Label>
                      <span>→</span>
                      <Select
                        value={columnMapping[csvCol]}
                        onValueChange={(value) =>
                          setColumnMapping((prev) => ({ ...prev, [csvCol]: value }))
                        }
                      >
                        <SelectTrigger className="w-64">
                          <SelectValue placeholder="Seleccionar campo" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(COLUMN_MAPPING).map(([key, value]) => (
                            <SelectItem key={key} value={value}>
                              {value}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {columnMapping[csvCol] && (
                        <Badge variant="outline" className="ml-2">
                          ✓
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-8 flex justify-between">
                  <Button variant="outline" onClick={() => setStep(1)}>
                    Volver
                  </Button>
                  <Button onClick={validateData}>
                    Validar y Continuar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="step3">
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
                      {validationErrors.filter(e => e.isCritical).length} Errores Críticos, {validationErrors.filter(e => !e.isCritical).length} Advertencias
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
                    
                    {validationErrors.some(e => !e.isCritical) && (
                      <div className="mt-4 flex items-center gap-3 p-3 bg-background rounded border">
                        <Switch
                          id="force-import"
                          checked={forceImport}
                          onCheckedChange={setForceImport}
                        />
                        <Label htmlFor="force-import" className="cursor-pointer">
                          Forzar importación ignorando advertencias (errores críticos seguirán bloqueando)
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
                      <SelectItem value="insert">
                        INSERT - Solo nuevos registros
                      </SelectItem>
                      <SelectItem value="upsert">
                        UPSERT - Actualizar si existe
                      </SelectItem>
                      <SelectItem value="skip">
                        SKIP - Saltar duplicados
                      </SelectItem>
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
                      {csvData.slice(0, 20).map((row, idx) => {
                        const mappedRow: Record<string, any> = {};
                        Object.entries(columnMapping).forEach(([csvCol, dbCol]) => {
                          mappedRow[dbCol] = row[csvCol];
                        });

                        return (
                          <TableRow key={idx}>
                            <TableCell className="font-mono">
                              {mappedRow.site_number}
                            </TableCell>
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
                  Mostrando 20 de {csvData.length} registros
                </p>

                <div className="mt-8 flex justify-between">
                  <Button variant="outline" onClick={() => setStep(2)}>
                    Volver
                  </Button>
                  <Button 
                    onClick={performImport} 
                    disabled={
                      importing || 
                      (validationErrors.filter(e => e.isCritical).length > 0) ||
                      (validationErrors.filter(e => !e.isCritical).length > 0 && !forceImport)
                    }
                  >
                    {importing ? "Importando..." : "Iniciar Importación"}
                  </Button>
                </div>

                {importing && (
                  <div className="mt-4">
                    <Progress value={importProgress} />
                    <p className="text-sm text-center mt-2">{Math.round(importProgress)}%</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="step4">
            {importResult && (
              <Card>
                <CardHeader>
                  <CardTitle>Importación Completada</CardTitle>
                  <CardDescription>Resumen de la operación</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="text-center p-4 border rounded-lg">
                      <FileSpreadsheet className="mx-auto h-8 w-8 mb-2 text-muted-foreground" />
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
                    <Button onClick={() => window.location.reload()}>
                      Nueva Importación
                    </Button>
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
