import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Loader2, Plus, Edit, X, Server, Info } from "lucide-react";
import type { RestaurantService } from "../types";

interface ServicesTabProps {
  servicesByRestaurant: Record<string, { restaurant: any; services: RestaurantService[] }>;
  isLoading: boolean;
  onEdit: (service: RestaurantService) => void;
  onToggleActive: (params: { id: string; activo: boolean }) => void;
  onNew: () => void;
}

export const ServicesTab = ({
  servicesByRestaurant,
  isLoading,
  onEdit,
  onToggleActive,
  onNew,
}: ServicesTabProps) => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Alert className="flex-1 mr-4">
          <Info className="h-4 w-4" />
          <AlertTitle>¿Qué son los Services?</AlertTitle>
          <AlertDescription>
            Los Services de Orquest representan secciones operativas dentro de un
            restaurante (ej: cocina, salón, barra). Un restaurante puede tener
            múltiples services para organizar mejor la planificación.
          </AlertDescription>
        </Alert>
        <Button onClick={onNew}>
          <Plus className="mr-2 h-4 w-4" />
          Añadir Service
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <Accordion type="multiple" className="space-y-4">
          {Object.entries(servicesByRestaurant).map(([centroId, { restaurant, services }]) => (
            <AccordionItem
              key={centroId}
              value={centroId}
              className="border rounded-lg bg-card"
            >
              <AccordionTrigger className="px-6 hover:no-underline">
                <div className="flex items-center gap-3">
                  <Server className="h-5 w-5 text-primary" />
                  <div className="text-left">
                    <div className="font-semibold">{restaurant.nombre}</div>
                    <div className="text-sm text-muted-foreground">
                      {restaurant.codigo} • {services.length} service{services.length !== 1 ? "s" : ""}
                    </div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-4">
                <div className="space-y-3 pt-3">
                  {services.map((service) => (
                    <Card key={service.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                                {service.orquest_service_id}
                              </code>
                              <Badge variant={service.activo ? "default" : "secondary"}>
                                {service.activo ? "Activo" : "Inactivo"}
                              </Badge>
                            </div>
                            {service.descripcion && (
                              <p className="text-sm text-muted-foreground mt-2">
                                {service.descripcion}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onEdit(service)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant={service.activo ? "destructive" : "default"}
                              onClick={() => onToggleActive({ id: service.id, activo: !service.activo })}
                            >
                              {service.activo ? <X className="h-4 w-4" /> : "Activar"}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
};
