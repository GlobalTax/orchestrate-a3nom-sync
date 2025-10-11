import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import type { ServiceFormData, RestaurantWithFranchisee } from "../../types";

interface ServiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: ServiceFormData;
  onFormDataChange: (data: ServiceFormData) => void;
  restaurants: RestaurantWithFranchisee[];
  isEditing: boolean;
  isSaving: boolean;
  onSubmit: () => void;
}

export const ServiceDialog = ({
  open,
  onOpenChange,
  formData,
  onFormDataChange,
  restaurants,
  isEditing,
  isSaving,
  onSubmit,
}: ServiceDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Service" : "Añadir Nuevo Service"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Modifica la información del service"
              : "Asocia un nuevo service de Orquest a un restaurante"}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="service_centro_id">Restaurante</Label>
            <Select
              value={formData.centro_id}
              onValueChange={(val) => onFormDataChange({ ...formData, centro_id: val })}
            >
              <SelectTrigger id="service_centro_id">
                <SelectValue placeholder="Seleccionar restaurante" />
              </SelectTrigger>
              <SelectContent>
                {restaurants.map((restaurant) => (
                  <SelectItem key={restaurant.id} value={restaurant.id}>
                    {restaurant.nombre} ({restaurant.codigo})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="orquest_service_id">Service ID de Orquest</Label>
            <Input
              id="orquest_service_id"
              value={formData.orquest_service_id}
              onChange={(e) =>
                onFormDataChange({ ...formData, orquest_service_id: e.target.value })
              }
              placeholder="ej: S001"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="service_descripcion">Descripción (opcional)</Label>
            <Textarea
              id="service_descripcion"
              value={formData.descripcion}
              onChange={(e) => onFormDataChange({ ...formData, descripcion: e.target.value })}
              placeholder="ej: Cocina principal"
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Actualizar" : "Crear"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
