import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Plus, Edit, Trash2, Info } from "lucide-react";
import type { Franchisee, RestaurantWithFranchisee } from "../types";

interface FranchiseesTabProps {
  franchisees: Franchisee[];
  restaurants: RestaurantWithFranchisee[];
  isLoading: boolean;
  onEdit: (franchisee: Franchisee) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}

export const FranchiseesTab = ({
  franchisees,
  restaurants,
  isLoading,
  onEdit,
  onDelete,
  onNew,
}: FranchiseesTabProps) => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Alert className="flex-1 mr-4">
          <Info className="h-4 w-4" />
          <AlertTitle>Gestión de Franquiciados</AlertTitle>
          <AlertDescription>
            Los franquiciados son los propietarios o gestores de negocio de los restaurantes.
            Aquí puedes gestionar su información (nombre, email, CIF).
          </AlertDescription>
        </Alert>
        <Button onClick={onNew}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Franquiciado
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Franquiciados Registrados</CardTitle>
          <CardDescription>
            {franchisees.length} franquiciado{franchisees.length !== 1 ? "s" : ""} en el sistema
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
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>CIF/NIF</TableHead>
                  <TableHead>Restaurantes</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {franchisees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No hay franquiciados registrados
                    </TableCell>
                  </TableRow>
                ) : (
                  franchisees.map((franchisee) => {
                    const restaurantsCount = restaurants.filter(
                      r => r.franchisee_id === franchisee.id
                    ).length;
                    return (
                      <TableRow key={franchisee.id}>
                        <TableCell className="font-medium">{franchisee.name}</TableCell>
                        <TableCell>{franchisee.email}</TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {franchisee.company_tax_id || "N/A"}
                          </code>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {restaurantsCount} restaurante{restaurantsCount !== 1 ? "s" : ""}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onEdit(franchisee)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => onDelete(franchisee.id)}
                              disabled={restaurantsCount > 0}
                              title={restaurantsCount > 0 ? "No se puede eliminar: tiene restaurantes asignados" : ""}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
