import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import type { CostCentreFormData, RestaurantWithFranchisee } from "../../types";

interface CostCentreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: CostCentreFormData;
  onFormDataChange: (data: CostCentreFormData) => void;
  restaurants: RestaurantWithFranchisee[];
  isEditing: boolean;
  isSaving: boolean;
  onSubmit: () => void;
}

export const CostCentreDialog = ({
  open,
  onOpenChange,
  formData,
  onFormDataChange,
  restaurants,
  isEditing,
  isSaving,
  onSubmit,
}: CostCentreDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Centro de Coste" : "Nuevo Centro de Coste"}
          </DialogTitle>
          <DialogDescription>
            Mapea un restaurante con su código de centro de coste en A3Nom
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cost_centro_id">
                Restaurante <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.centro_id}
                onValueChange={(val) => onFormDataChange({ ...formData, centro_id: val })}
              >
                <SelectTrigger id="cost_centro_id">
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
              <Label htmlFor="a3_centro_code">
                Código Centro A3 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="a3_centro_code"
                value={formData.a3_centro_code}
                onChange={(e) =>
                  onFormDataChange({ ...formData, a3_centro_code: e.target.value })
                }
                placeholder="Ej: CC001"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cost_descripcion">Descripción (opcional)</Label>
            <Input
              id="cost_descripcion"
              value={formData.descripcion}
              onChange={(e) => onFormDataChange({ ...formData, descripcion: e.target.value })}
              placeholder="Descripción del centro de coste"
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
