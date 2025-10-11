import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import type { ImportStats } from "../hooks/useFileImport";

export interface ImportProgressProps {
  progress: number;
  stats: ImportStats;
  isComplete?: boolean;
}

export const ImportProgress = ({ progress, stats, isComplete = false }: ImportProgressProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isComplete ? (
            <>
              <CheckCircle className="h-5 w-5 text-success" />
              Importación Completada
            </>
          ) : (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              Importando datos...
            </>
          )}
        </CardTitle>
        <CardDescription>
          Procesando {stats.total} registros
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progreso</span>
            <span className="font-medium">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-success" />
              <p className="text-sm text-muted-foreground">Cargados</p>
            </div>
            <p className="text-2xl font-bold text-success">{stats.loaded}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <p className="text-sm text-muted-foreground">Omitidos</p>
            </div>
            <p className="text-2xl font-bold text-warning">{stats.skipped}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-destructive" />
              <p className="text-sm text-muted-foreground">Errores</p>
            </div>
            <p className="text-2xl font-bold text-destructive">{stats.errors}</p>
          </div>
        </div>

        {isComplete && (
          <div className="flex gap-2 flex-wrap">
            {stats.loaded > 0 && (
              <Badge variant="default" className="gap-1">
                <CheckCircle className="h-3 w-3" />
                {stats.loaded} exitosos
              </Badge>
            )}
            {stats.skipped > 0 && (
              <Badge variant="secondary" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                {stats.skipped} omitidos
              </Badge>
            )}
            {stats.errors > 0 && (
              <Badge variant="destructive" className="gap-1">
                <XCircle className="h-3 w-3" />
                {stats.errors} errores
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
