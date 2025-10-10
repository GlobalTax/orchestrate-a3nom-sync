/**
 * @deprecated Esta página ha sido consolidada en /admin/restaurantes (tab Centros de Coste)
 * Se mantiene por compatibilidad pero se recomienda usar el nuevo componente Restaurantes.
 * Esta página será eliminada en futuras versiones.
 */
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Plus, DollarSign, Pencil, Power, Loader2, Info } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface CostCentre {
  id: string;
  centro_id: string;
  a3_centro_code: string;
  descripcion: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

interface Centre {
  id: string;
  codigo: string;
  nombre: string;
}

const CostCentres = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin, loading: roleLoading } = useUserRole();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCostCentre, setEditingCostCentre] = useState<CostCentre | null>(null);
  const [formData, setFormData] = useState({
    centro_id: "",
    a3_centro_code: "",
    descripcion: "",
  });

  // Fetch centres for dropdown
  const { data: centres = [] } = useQuery({
    queryKey: ["centres"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("centres")
        .select("id, codigo, nombre")
        .eq("activo", true)
        .order("nombre");
      
      if (error) throw error;
      return data as Centre[];
    },
    enabled: isAdmin,
  });

  // Fetch cost centres with centre names
  const { data: costCentres = [], isLoading } = useQuery({
    queryKey: ["cost_centres"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurant_cost_centres")
        .select(`
          *,
          centres:centro_id (
            codigo,
            nombre
          )
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as (CostCentre & { centres: Centre })[];
    },
    enabled: isAdmin,
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (editingCostCentre) {
        const { error } = await supabase
          .from("restaurant_cost_centres")
          .update(data)
          .eq("id", editingCostCentre.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("restaurant_cost_centres")
          .insert([{ ...data, activo: true }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cost_centres"] });
      toast.success(editingCostCentre ? "Centro de coste actualizado" : "Centro de coste creado");
      resetForm();
    },
    onError: (error: any) => {
      toast.error("Error al guardar: " + error.message);
    },
  });

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const costCentre = costCentres.find(c => c.id === id);
      if (!costCentre) return;

      const { error } = await supabase
        .from("restaurant_cost_centres")
        .update({ activo: !costCentre.activo })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cost_centres"] });
      toast.success("Estado actualizado");
    },
    onError: (error: any) => {
      toast.error("Error: " + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.centro_id || !formData.a3_centro_code) {
      toast.error("Por favor completa los campos obligatorios");
      return;
    }

    saveMutation.mutate(formData);
  };

  const handleEdit = (costCentre: CostCentre & { centres: Centre }) => {
    setEditingCostCentre(costCentre);
    setFormData({
      centro_id: costCentre.centro_id,
      a3_centro_code: costCentre.a3_centro_code,
      descripcion: costCentre.descripcion || "",
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      centro_id: "",
      a3_centro_code: "",
      descripcion: "",
    });
    setEditingCostCentre(null);
    setDialogOpen(false);
  };

  if (roleLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!isAdmin) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Acceso Denegado</h2>
            <p className="text-muted-foreground mb-4">
              No tienes permisos para acceder a esta página
            </p>
            <Button onClick={() => navigate("/dashboard")}>
              Volver al Dashboard
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/centros")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <DollarSign className="h-8 w-8" />
              Centros de Coste
            </h1>
            <p className="text-muted-foreground mt-1">
              Mapeo entre restaurantes y centros de coste A3Nom
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Centro de Coste
          </Button>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>¿Para qué sirven los Centros de Coste?</AlertTitle>
          <AlertDescription>
            Los centros de coste de A3Nom se mapean a restaurantes. Un restaurante puede
            tener múltiples centros de coste si su contabilidad está distribuida. Esto
            permite consolidar la información de nóminas de diferentes códigos A3 bajo un
            mismo restaurante en la aplicación.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Centros de Coste Registrados</CardTitle>
            <CardDescription>
              {costCentres.length} centro{costCentres.length !== 1 ? "s" : ""} de coste en el sistema
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
                    <TableHead>Código Centro</TableHead>
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
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {costCentre.centres?.codigo || "N/A"}
                          </code>
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
                              onClick={() => handleEdit(costCentre)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => toggleActiveMutation.mutate(costCentre.id)}
                              disabled={toggleActiveMutation.isPending}
                              title={costCentre.activo ? "Desactivar" : "Activar"}
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

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingCostCentre ? "Editar Centro de Coste" : "Crear Nuevo Centro de Coste"}
              </DialogTitle>
              <DialogDescription>
                Mapea un restaurante con su código de centro de coste en A3Nom
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="centro_id">
                    Restaurante <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.centro_id}
                    onValueChange={(val) => setFormData({ ...formData, centro_id: val })}
                  >
                    <SelectTrigger id="centro_id">
                      <SelectValue placeholder="Seleccionar restaurante" />
                    </SelectTrigger>
                    <SelectContent>
                      {centres.map((centre) => (
                        <SelectItem key={centre.id} value={centre.id}>
                          {centre.nombre} ({centre.codigo})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="a3_centro_code">
                    Código Centro A3 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="a3_centro_code"
                    value={formData.a3_centro_code}
                    onChange={(e) => setFormData({ ...formData, a3_centro_code: e.target.value })}
                    placeholder="Ej: CC001"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="descripcion">Descripción (opcional)</Label>
                <Input
                  id="descripcion"
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  placeholder="Descripción del centro de coste"
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingCostCentre ? "Actualizar" : "Crear"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default CostCentres;
