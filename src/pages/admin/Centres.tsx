import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Building2, Plus, Pencil, Power, PowerOff, Loader2 } from "lucide-react";

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

  if (roleLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!isAdmin) {
    return (
      <Layout>
        <div className="text-center py-12">
          <Building2 className="h-12 w-12 mx-auto text-destructive mb-4" />
          <h2 className="text-2xl font-bold">Acceso Denegado</h2>
          <p className="text-muted-foreground">Solo administradores pueden gestionar centros</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Building2 className="h-8 w-8" />
              Gestión de Centros
            </h1>
            <p className="text-muted-foreground mt-1">
              Administra los centros de trabajo de la organización
            </p>
          </div>
          
          <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} className="gap-2">
            <Plus className="h-4 w-4" />
            Nuevo Centro
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Centros Registrados</CardTitle>
            <CardDescription>
              {centres.length} centro{centres.length !== 1 ? "s" : ""} en el sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : centres.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No hay centros registrados
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
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {centres.map((centre) => (
                    <TableRow key={centre.id}>
                      <TableCell className="font-medium">{centre.codigo}</TableCell>
                      <TableCell>{centre.nombre}</TableCell>
                      <TableCell>{centre.ciudad || "-"}</TableCell>
                      <TableCell>
                        {centre.orquest_service_id ? (
                          <Badge variant="outline" className="text-blue-600">
                            Mapeado
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-orange-600">
                            Sin mapear
                          </Badge>
                        )}
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
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(centre)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleActiveMutation.mutate({ id: centre.id, activo: centre.activo })}
                            disabled={toggleActiveMutation.isPending}
                          >
                            {centre.activo ? (
                              <PowerOff className="h-4 w-4 text-orange-600" />
                            ) : (
                              <Power className="h-4 w-4 text-green-600" />
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
                {editingCentre ? "Editar Centro" : "Crear Nuevo Centro"}
              </DialogTitle>
              <DialogDescription>
                {editingCentre ? "Modifica la información del centro" : "Completa los datos del nuevo centro"}
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
                  <Label htmlFor="orquest_service_id">Service ID (Orquest)</Label>
                  <Input
                    id="orquest_service_id"
                    placeholder="ej: service_456"
                    value={formData.orquest_service_id}
                    onChange={(e) => setFormData({ ...formData, orquest_service_id: e.target.value })}
                  />
                </div>
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
    </Layout>
  );
};

export default Centres;
