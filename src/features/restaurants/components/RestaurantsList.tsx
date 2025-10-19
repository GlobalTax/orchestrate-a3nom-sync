import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Pencil, Power, PowerOff, Wifi, ArrowRight } from "lucide-react";
import type { RestaurantWithFranchisee } from "../types";

interface RestaurantsListProps {
  restaurants: RestaurantWithFranchisee[];
  servicesCount: Record<string, number>;
  isLoading: boolean;
  testingCentre: string | null;
  onEdit: (restaurant: RestaurantWithFranchisee) => void;
  onToggleActive: (id: string) => void;
  onTestConnection: (id: string) => void;
  onNavigateToServices: () => void;
}

export const RestaurantsList = ({
  restaurants,
  servicesCount,
  isLoading,
  testingCentre,
  onEdit,
  onToggleActive,
  onTestConnection,
  onNavigateToServices,
}: RestaurantsListProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Restaurantes Registrados</CardTitle>
        <CardDescription>
          {restaurants.length} restaurante{restaurants.length !== 1 ? "s" : ""}
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
                <TableHead>Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Ciudad</TableHead>
                <TableHead>Franquiciado</TableHead>
                <TableHead>Business ID</TableHead>
                <TableHead>Services</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {restaurants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    No hay restaurantes registrados
                  </TableCell>
                </TableRow>
              ) : (
                restaurants.map((restaurant) => (
                  <TableRow key={restaurant.id}>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        {restaurant.codigo}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{restaurant.nombre}</TableCell>
                    <TableCell>{restaurant.ciudad || "N/A"}</TableCell>
                    <TableCell>
                      {restaurant.franchisee_name ? (
                        <div>
                          <div className="font-medium text-sm">{restaurant.franchisee_name}</div>
                          <div className="text-xs text-muted-foreground">{restaurant.franchisee_email}</div>
                        </div>
                      ) : (
                        <Badge variant="outline">Sin asignar</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {restaurant.orquest_business_id || "N/A"}
                      </code>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {servicesCount[restaurant.id] || 0} service{servicesCount[restaurant.id] !== 1 ? "s" : ""}
                        </Badge>
                        {servicesCount[restaurant.id] > 0 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={onNavigateToServices}
                          >
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={restaurant.activo ? "default" : "secondary"}>
                        {restaurant.activo ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {restaurant.orquest_business_id && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onTestConnection(restaurant.id)}
                            disabled={testingCentre === restaurant.id}
                          >
                            {testingCentre === restaurant.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Wifi className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onEdit(restaurant)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onToggleActive(restaurant.id)}
                        >
                          {restaurant.activo ? (
                            <PowerOff className="h-4 w-4 text-red-600" />
                          ) : (
                            <Power className="h-4 w-4 text-green-600" />
                          )}
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
  );
};
