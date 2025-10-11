import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Loader2, Upload, UserPlus, Users, Trash2, Info } from "lucide-react";
import type { RestaurantWithFranchisee, GestorAssignment } from "../types";

interface GestoresTabProps {
  restaurants: RestaurantWithFranchisee[];
  gestoresByCentro: Record<string, GestorAssignment[]>;
  isLoading: boolean;
  onAssign: (centroCodigo: string) => void;
  onRemove: (roleId: string) => void;
  onAutoAssign: () => void;
  onImportCSV: () => void;
}

export const GestoresTab = ({
  restaurants,
  gestoresByCentro,
  isLoading,
  onAssign,
  onRemove,
  onAutoAssign,
  onImportCSV,
}: GestoresTabProps) => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <Alert className="flex-1">
          <Info className="h-4 w-4" />
          <AlertTitle>Control de Acceso al Sistema</AlertTitle>
          <AlertDescription>
            Los gestores tienen acceso limitado a los datos de su restaurante asignado.
            Esto es diferente a los franquiciados (propietarios del negocio).
            Desde aquí puedes asignar qué usuarios pueden acceder a qué restaurantes.
          </AlertDescription>
        </Alert>
        <div className="flex gap-2">
          <Button onClick={onImportCSV} variant="outline">
            <Upload className="mr-2 h-4 w-4" />
            Importar CSV
          </Button>
          <Button onClick={onAutoAssign}>
            <UserPlus className="mr-2 h-4 w-4" />
            Auto-asignar
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <Accordion type="multiple" className="space-y-4">
          {restaurants.map((restaurant) => {
            const gestores = gestoresByCentro[restaurant.codigo] || [];
            return (
              <AccordionItem
                key={restaurant.id}
                value={restaurant.id}
                className="border rounded-lg bg-card"
              >
                <AccordionTrigger className="px-6 hover:no-underline">
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-primary" />
                    <div className="text-left">
                      <div className="font-semibold">{restaurant.nombre}</div>
                      <div className="text-sm text-muted-foreground">
                        {restaurant.codigo} • {gestores.length} gestor{gestores.length !== 1 ? "es" : ""}
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-4">
                  <div className="space-y-3 pt-3">
                    <Button size="sm" onClick={() => onAssign(restaurant.codigo)}>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Añadir Gestor
                    </Button>

                    {gestores.length === 0 ? (
                      <div className="text-center text-muted-foreground py-8">
                        No hay gestores asignados a este restaurante
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {gestores.map((gestor) => (
                          <Card key={gestor.roleId}>
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="font-medium">
                                    {gestor.nombre} {gestor.apellidos}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    {gestor.email}
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => onRemove(gestor.roleId)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </div>
  );
};
