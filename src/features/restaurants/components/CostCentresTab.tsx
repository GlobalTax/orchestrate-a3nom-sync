import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Plus, Pencil, Power, Info } from "lucide-react";
import type { CostCentre } from "../types";

interface CostCentresTabProps {
  costCentres: CostCentre[];
  isLoading: boolean;
  onEdit: (costCentre: CostCentre) => void;
  onToggleActive: (id: string) => void;
  onNew: () => void;
}

export const CostCentresTab = ({
  costCentres,
  isLoading,
  onEdit,
  onToggleActive,
  onNew,
}: CostCentresTabProps) => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Alert className="flex-1 mr-4">
          <Info className="h-4 w-4" />
          <AlertTitle>¿Para qué sirven los Centros de Coste?</AlertTitle>
          <AlertDescription>
            Los centros de coste de A3Nom se mapean a restaurantes. Un restaurante puede
            tener múltiples centros de coste si su contabilidad está distribuida.
          </AlertDescription>
        </Alert>
        <Button onClick={onNew}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Centro de Coste
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Centros de Coste Registrados</CardTitle>
          <CardDescription>
            {costCentres.length} centro{costCentres.length !== 1 ? "s" : ""} de coste
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Restaurante</TableHead>
                  <TableHead>Código Restaurante</TableHead>
                  <TableHead>Código A3</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {costCentres.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No hay centros de coste registrados
                    </TableCell>
                  </TableRow>
                ) : (
                  costCentres.map((costCentre) => (
                    <TableRow key={costCentre.id}>
                      <TableCell className="font-medium">
                        {costCentre.centres?.nombre || "N/A"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">
                          {costCentre.centres?.codigo || "N/A"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                          {costCentre.a3_centro_code}
                        </code>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {costCentre.descripcion || "Sin descripción"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={costCentre.activo ? "default" : "secondary"}>
                          {costCentre.activo ? "Activo" : "Inactivo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onEdit(costCentre)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onToggleActive(costCentre.id)}
                          >
                            <Power
                              className={`h-4 w-4 ${
                                costCentre.activo ? "text-green-600" : "text-gray-400"
                              }`}
                            />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
