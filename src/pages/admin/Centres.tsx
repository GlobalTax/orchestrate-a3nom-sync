/**
 * @deprecated Esta página ha sido consolidada en /admin/restaurantes
 * Se mantiene por compatibilidad pero se recomienda usar el nuevo componente Restaurantes.
 * Esta página será eliminada en futuras versiones.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Building2, Plus, Pencil, Power, PowerOff, Loader2, RefreshCw, Wifi, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Centre {
  id: string;
  codigo: string;
  nombre: string;
  direccion: string | null;
  ciudad: string | null;
  pais: string;
  activo: boolean;
  orquest_service_id: string | null;
  orquest_business_id: string | null;
  created_at: string;
  updated_at: string;
}

const Centres = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin, loading: roleLoading } = useUserRole();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCentre, setEditingCentre] = useState<Centre | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [syncingCentre, setSyncingCentre] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    codigo: "",
    nombre: "",
    direccion: "",
    ciudad: "",
    pais: "España",
    orquest_service_id: "",
    orquest_business_id: "",
  });

  // Fetch centres
  const { data: centres = [], isLoading } = useQuery({
    queryKey: ["centres"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("centres")
        .select("*")
        .order("codigo");
      
      if (error) throw error;
      return data as Centre[];
    },
    enabled: !roleLoading && isAdmin,
  });

  // Create/update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (editingCentre) {
        const { error } = await supabase
          .from("centres")
          .update(data)
          .eq("id", editingCentre.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("centres")
          .insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["centres"] });
      toast.success(editingCentre ? "Centro actualizado" : "Centro creado");
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error("Error al guardar: " + error.message);
    },
  });

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, activo }: { id: string; activo: boolean }) => {
      const { error } = await supabase
        .from("centres")
        .update({ activo: !activo })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["centres"] });
      toast.success("Estado del centro actualizado");
    },
    onError: (error: any) => {
      toast.error("Error al actualizar: " + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.codigo || !formData.nombre) {
      toast.error("Código y nombre son obligatorios");
      return;
    }

    saveMutation.mutate(formData);
  };

  const handleEdit = (centre: Centre) => {
    setEditingCentre(centre);
    setFormData({
      codigo: centre.codigo,
      nombre: centre.nombre,
      direccion: centre.direccion || "",
      ciudad: centre.ciudad || "",
      pais: centre.pais,
      orquest_service_id: centre.orquest_service_id || "",
      orquest_business_id: centre.orquest_business_id || "",
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingCentre(null);
    setFormData({
      codigo: "",
      nombre: "",
      direccion: "",
      ciudad: "",
      pais: "España",
      orquest_service_id: "",
      orquest_business_id: "",
    });
  };

  const testOrquestConnection = async () => {
    if (!formData.orquest_service_id) {
      toast.error("Debes especificar un Service ID para probar la conexión");
      return;
    }

    setTestingConnection(true);
    try {
      const { data, error } = await supabase.functions.invoke('test_orquest_connection', {
        body: {
          service_id: formData.orquest_service_id,
          business_id: formData.orquest_business_id || null,
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(`Conexión exitosa! ${data.employees_count || 0} empleados encontrados`);
      } else {
        toast.error("Error al conectar con Orquest");
      }
    } catch (error: any) {
      toast.error("Error al probar conexión: " + error.message);
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSyncNow = async (centre: Centre) => {
    if (!centre.orquest_service_id) {
      toast.error("Este restaurante no tiene configuración de Orquest");
      return;
    }

    setSyncingCentre(centre.id);
    try {
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const endDate = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase.functions.invoke('sync_orquest', {
        body: {
          sync_type: 'all',
          start_date: startDate,
          end_date: endDate,
          centro_code: centre.codigo,
        },
      });

      if (error) throw error;

      toast.success(`Sincronización iniciada para ${centre.nombre}`);
      
      setTimeout(() => navigate('/admin/sincronizar'), 1500);
    } catch (error: any) {
      toast.error("Error al iniciar sincronización: " + error.message);
    } finally {
      setSyncingCentre(null);
    }
  };

  const isOrquestConfigured = (centre: Centre) => {
    return !!(centre.orquest_service_id);
  };

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="text-center py-12">
        <Building2 className="h-12 w-12 mx-auto text-destructive mb-4" />
        <h2 className="text-2xl font-bold">Acceso Denegado</h2>
        <p className="text-muted-foreground">Solo administradores pueden gestionar centros</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
        <div className="flex justify-between items-center">
          <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Building2 className="h-8 w-8" />
          Gestión de Restaurantes
        </h1>
        <p className="text-muted-foreground mt-1">
          Administra los restaurantes de la organización
        </p>
          </div>
          
          <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} className="gap-2">
            <Plus className="h-4 w-4" />
            Nuevo Restaurante
          </Button>
        </div>

        <Card>
          <CardHeader>
          <CardTitle>Restaurantes Registrados</CardTitle>
          <CardDescription>
            {centres.length} restaurante{centres.length !== 1 ? "s" : ""} en el sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : centres.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No hay restaurantes registrados
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Ciudad</TableHead>
                    <TableHead>Orquest</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {centres.map((centre) => (
                    <TableRow key={centre.id}>
                      <TableCell className="font-medium">{centre.codigo}</TableCell>
                      <TableCell>{centre.nombre}</TableCell>
                      <TableCell>{centre.ciudad || "-"}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {centre.orquest_business_id ? (
                      <>
                        <Badge variant="outline" className="text-green-600">
                          ✓ Business ID
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => navigate(`/admin/services?restaurant=${centre.id}`)}
                          className="text-xs text-blue-600 hover:text-blue-700"
                        >
                          Ver services →
                        </Button>
                      </>
                    ) : (
                      <Badge variant="outline" className="text-orange-600">
                        ⚠ Sin configurar
                      </Badge>
                    )}
                  </div>
                </TableCell>
                      <TableCell>
                        {centre.activo ? (
                          <Badge variant="outline" className="text-green-600">
                            Activo
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-gray-600">
                            Inactivo
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(centre)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => toggleActiveMutation.mutate({ id: centre.id, activo: centre.activo })}
                            disabled={toggleActiveMutation.isPending}
                            title={centre.activo ? "Desactivar restaurante" : "Activar restaurante"}
                          >
                            {centre.activo ? (
                              <PowerOff className="h-4 w-4 text-orange-600" />
                            ) : (
                              <Power className="h-4 w-4 text-green-600" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSyncNow(centre)}
                            disabled={!isOrquestConfigured(centre) || syncingCentre === centre.id}
                            title="Sincronizar con Orquest ahora"
                          >
                            {syncingCentre === centre.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4 text-blue-600" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Create/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingCentre ? "Editar Restaurante" : "Crear Nuevo Restaurante"}
              </DialogTitle>
              <DialogDescription>
                {editingCentre ? "Modifica la información del restaurante" : "Completa los datos del nuevo restaurante"}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="codigo">Código *</Label>
                <Input
                  id="codigo"
                  placeholder="ej: MAD-01"
                  value={formData.codigo}
                  onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                  disabled={!!editingCentre}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre *</Label>
                <Input
                  id="nombre"
                  placeholder="ej: Centro Madrid Norte"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="direccion">Dirección</Label>
                <Input
                  id="direccion"
                  placeholder="Calle ejemplo 123"
                  value={formData.direccion}
                  onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="ciudad">Ciudad</Label>
                  <Input
                    id="ciudad"
                    placeholder="Madrid"
                    value={formData.ciudad}
                    onChange={(e) => setFormData({ ...formData, ciudad: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pais">País</Label>
                  <Input
                    id="pais"
                    placeholder="España"
                    value={formData.pais}
                    onChange={(e) => setFormData({ ...formData, pais: e.target.value })}
                  />
                </div>
              </div>

              <div className="border-t pt-4 space-y-4">
                <div className="space-y-1">
                  <Label className="text-base font-semibold">Mapeo con Orquest</Label>
                  <p className="text-sm text-muted-foreground">
                    Vincula este centro con un Service de Orquest
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="orquest_business_id">Business ID (Orquest)</Label>
                  <Input
                    id="orquest_business_id"
                    placeholder="ej: business_123"
                    value={formData.orquest_business_id}
                    onChange={(e) => setFormData({ ...formData, orquest_business_id: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="orquest_service_id">Service ID (Orquest) *</Label>
                  <Input
                    id="orquest_service_id"
                    placeholder="ej: service_456"
                    value={formData.orquest_service_id}
                    onChange={(e) => setFormData({ ...formData, orquest_service_id: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Requerido para sincronización con Orquest
                  </p>
                </div>

                {formData.orquest_service_id && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={testOrquestConnection}
                    disabled={testingConnection}
                    className="w-full"
                  >
                    {testingConnection ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Probando conexión...
                      </>
                    ) : (
                      "Probar Conexión con Orquest"
                    )}
                  </Button>
                )}
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Guardando...
                    </>
                  ) : editingCentre ? (
                    "Actualizar"
                  ) : (
                    "Crear"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
  );
};

export default Centres;
