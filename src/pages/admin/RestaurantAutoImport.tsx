import { useState } from "react";
import { PageHeader } from "@/components/common";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { ImportService, ImportResult } from "@/services/api/import.service";
import { AlertCircle, CheckCircle2, Upload, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function RestaurantAutoImport() {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [progress, setProgress] = useState(0);

  const handleImport = async () => {
    setImporting(true);
    setProgress(0);
    setResult(null);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 5, 90));
      }, 500);

      const importResult = await ImportService.executePublicCSVImport();
      
      clearInterval(progressInterval);
      setProgress(100);
      setResult(importResult);
    } catch (error: any) {
      console.error('Import error:', error);
      setResult({
        success: false,
        total: 0,
        inserted: 0,
        updated: 0,
        errors: 1,
        message: error.message,
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader
        title="Importación Automática de Restaurantes"
        description="Importar los 638 restaurantes desde restaurant_rows.csv"
      />

      <Card>
        <CardHeader>
          <CardTitle>Importación desde CSV Público</CardTitle>
          <CardDescription>
            Este proceso importará automáticamente todos los restaurantes desde el archivo
            <code className="mx-1 px-2 py-1 bg-muted rounded">public/restaurant_rows.csv</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Proceso automático:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Creará o actualizará franquiciados necesarios</li>
                <li>Insertará restaurantes nuevos</li>
                <li>Actualizará restaurantes existentes (basado en ID)</li>
                <li>Durará aproximadamente 2-3 minutos</li>
              </ul>
            </AlertDescription>
          </Alert>

          {!result && (
            <Button
              onClick={handleImport}
              disabled={importing}
              size="lg"
              className="w-full"
            >
              {importing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Iniciar Importación
                </>
              )}
            </Button>
          )}

          {importing && (
            <div className="space-y-2">
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-muted-foreground text-center">
                Procesando restaurantes... {progress}%
              </p>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              <Alert variant={result.success ? "default" : "destructive"}>
                {result.success ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertDescription>
                  <strong>{result.message}</strong>
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardDescription>Total</CardDescription>
                    <CardTitle className="text-3xl">{result.total}</CardTitle>
                  </CardHeader>
                </Card>
                
                <Card>
                  <CardHeader className="pb-3">
                    <CardDescription>Insertados</CardDescription>
                    <CardTitle className="text-3xl text-green-600">
                      {result.inserted}
                    </CardTitle>
                  </CardHeader>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardDescription>Actualizados</CardDescription>
                    <CardTitle className="text-3xl text-blue-600">
                      {result.updated}
                    </CardTitle>
                  </CardHeader>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardDescription>Errores</CardDescription>
                    <CardTitle className="text-3xl text-red-600">
                      {result.errors}
                    </CardTitle>
                  </CardHeader>
                </Card>
              </div>

              {result.errorDetails && result.errorDetails.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Detalles de Errores</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {result.errorDetails.map((err, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-sm">
                          <Badge variant="destructive" className="shrink-0">
                            Error
                          </Badge>
                          <div>
                            <p className="font-medium">{err.restaurant}</p>
                            <p className="text-muted-foreground">{err.error}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Button
                onClick={() => {
                  setResult(null);
                  setProgress(0);
                }}
                variant="outline"
                className="w-full"
              >
                Importar de Nuevo
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
