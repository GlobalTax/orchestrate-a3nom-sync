import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import { Server, Plus, Wifi, X, Edit, Loader2, Info } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";

interface RestaurantService {
  id: string;
  centro_id: string;
  orquest_service_id: string;
  descripcion: string | null;
  activo: boolean;
  centres: {
    codigo: string;
    nombre: string;
  };
}

const Services = () => {
  const { isAdmin } = useUserRole();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [testingService, setTestingService] = useState<string | null>(null);
  const [editingService, setEditingService] = useState<RestaurantService | null>(null);
  
  const [formData, setFormData] = useState({
    centro_id: "",
    orquest_service_id: "",
    descripcion: "",
  });

  const { data: restaurantServices, isLoading } = useQuery({
    queryKey: ["restaurant_services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurant_services")
        .select(`
          *,
          centres:centro_id (
            codigo,
            nombre
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as RestaurantService[];
    },
  });

  const { data: availableCentres } = useQuery({
    queryKey: ["centres_for_services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("centres")
        .select("id, codigo, nombre")
        .eq("activo", true)
        .order("nombre");

      if (error) throw error;
      return data;
    },
  });

  // Group services by restaurant
  const servicesByRestaurant = restaurantServices?.reduce((acc, service) => {
    const key = service.centro_id;
    if (!acc[key]) {
      acc[key] = {
        restaurant: service.centres,
        services: [],
      };
    }
    acc[key].services.push(service);
    return acc;
  }, {} as Record<string, { restaurant: any; services: RestaurantService[] }>);

  const createMutation = useMutation({
    mutationFn: async (newService: typeof formData) => {
      const { data, error } = await supabase
        .from("restaurant_services")
        .insert([newService])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restaurant_services"] });
      toast.success("Service creado correctamente");
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error("Error al crear service: " + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<typeof formData> }) => {
      const { data, error } = await supabase
        .from("restaurant_services")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restaurant_services"] });
      toast.success("Service actualizado correctamente");
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error("Error al actualizar service: " + error.message);
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, activo }: { id: string; activo: boolean }) => {
      const { data, error } = await supabase
        .from("restaurant_services")
        .update({ activo })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restaurant_services"] });
      toast.success("Estado actualizado correctamente");
    },
    onError: (error: any) => {
      toast.error("Error al actualizar estado: " + error.message);
    },
  });

  const testConnection = async (serviceId: string, businessId?: string) => {
    setTestingService(serviceId);
    try {
      const { data, error } = await supabase.functions.invoke("test_orquest_connection", {
        body: {
          service_id: serviceId,
          business_id: businessId,
        },
      });

      if (error) throw error;

      if (data.success) {
        toast.success(
          `✅ Conexión exitosa: ${data.employees_count} empleados encontrados`
        );
      } else {
        toast.error("Error en la conexión: " + data.message);
      }
    } catch (error: any) {
      toast.error("Error al probar conexión: " + error.message);
    } finally {
      setTestingService(null);
    }
  };

  const resetForm = () => {
    setFormData({
      centro_id: "",
      orquest_service_id: "",
      descripcion: "",
    });
    setEditingService(null);
  };

  const handleEdit = (service: RestaurantService) => {
    setEditingService(service);
    setFormData({
      centro_id: service.centro_id,
      orquest_service_id: service.orquest_service_id,
      descripcion: service.descripcion || "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingService) {
      updateMutation.mutate({ id: editingService.id, updates: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  if (!isAdmin) {
    return (
      <Layout>
        <div className="p-6">
          <Alert variant="destructive">
            <AlertTitle>Acceso denegado</AlertTitle>
            <AlertDescription>
              No tienes permisos para acceder a esta página.
            </AlertDescription>
          </Alert>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-6 animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Server className="h-8 w-8" />
              Services de Orquest
            </h1>
            <p className="text-muted-foreground mt-1">
              Gestiona los services de Orquest asociados a cada restaurante
            </p>
          </div>

          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Añadir Service
          </Button>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>¿Qué son los Services?</AlertTitle>
          <AlertDescription>
            Los Services de Orquest representan secciones operativas dentro de un
            restaurante (ej: cocina, salón, barra). Un restaurante puede tener
            múltiples services para organizar mejor la planificación.
          </AlertDescription>
        </Alert>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Accordion type="multiple" className="space-y-4">
            {servicesByRestaurant && Object.entries(servicesByRestaurant).map(([centroId, { restaurant, services }]) => (
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
                                onClick={() => testConnection(service.orquest_service_id)}
                                disabled={testingService === service.orquest_service_id}
                              >
                                {testingService === service.orquest_service_id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Wifi className="h-4 w-4 text-blue-600" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEdit(service)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant={service.activo ? "destructive" : "default"}
                                onClick={() =>
                                  toggleActiveMutation.mutate({
                                    id: service.id,
                                    activo: !service.activo,
                                  })
                                }
                              >
                                {service.activo ? (
                                  <X className="h-4 w-4" />
                                ) : (
                                  "Activar"
                                )}
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

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingService ? "Editar Service" : "Añadir Nuevo Service"}
              </DialogTitle>
              <DialogDescription>
                {editingService
                  ? "Modifica la información del service"
                  : "Asocia un nuevo service de Orquest a un restaurante"}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="centro_id">Restaurante</Label>
                <select
                  id="centro_id"
                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                  value={formData.centro_id}
                  onChange={(e) =>
                    setFormData({ ...formData, centro_id: e.target.value })
                  }
                  required
                  disabled={!!editingService}
                >
                  <option value="">Seleccionar restaurante...</option>
                  {availableCentres?.map((centro) => (
                    <option key={centro.id} value={centro.id}>
                      {centro.nombre} ({centro.codigo})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="orquest_service_id">Service ID de Orquest</Label>
                <Input
                  id="orquest_service_id"
                  value={formData.orquest_service_id}
                  onChange={(e) =>
                    setFormData({ ...formData, orquest_service_id: e.target.value })
                  }
                  placeholder="ej: S001"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="descripcion">Descripción (opcional)</Label>
                <Textarea
                  id="descripcion"
                  value={formData.descripcion}
                  onChange={(e) =>
                    setFormData({ ...formData, descripcion: e.target.value })
                  }
                  placeholder="ej: Cocina principal"
                  rows={3}
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDialogOpen(false);
                    resetForm();
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {editingService ? "Actualizar" : "Crear"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default Services;
