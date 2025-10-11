import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import type { RestaurantFormData, Franchisee } from "../../types";

interface RestaurantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: RestaurantFormData;
  onFormDataChange: (data: RestaurantFormData) => void;
  franchisees: Franchisee[];
  isEditing: boolean;
  isSaving: boolean;
  onSubmit: () => void;
}

export const RestaurantDialog = ({
  open,
  onOpenChange,
  formData,
  onFormDataChange,
  franchisees,
  isEditing,
  isSaving,
  onSubmit,
}: RestaurantDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Restaurante" : "Nuevo Restaurante"}
          </DialogTitle>
          <DialogDescription>
            Completa la información del restaurante y su configuración Orquest
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
              <Label htmlFor="codigo">
                Código <span className="text-red-500">*</span>
              </Label>
              <Input
                id="codigo"
                value={formData.codigo}
                onChange={(e) => onFormDataChange({ ...formData, codigo: e.target.value })}
                placeholder="Ej: MAD-001"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nombre">
                Nombre <span className="text-red-500">*</span>
              </Label>
              <Input
                id="nombre"
                value={formData.nombre}
                onChange={(e) => onFormDataChange({ ...formData, nombre: e.target.value })}
                placeholder="Nombre del restaurante"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="direccion">Dirección</Label>
            <Input
              id="direccion"
              value={formData.direccion}
              onChange={(e) => onFormDataChange({ ...formData, direccion: e.target.value })}
              placeholder="Dirección completa"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ciudad">Ciudad</Label>
              <Input
                id="ciudad"
                value={formData.ciudad}
                onChange={(e) => onFormDataChange({ ...formData, ciudad: e.target.value })}
                placeholder="Ciudad"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">Provincia</Label>
              <Input
                id="state"
                value={formData.state}
                onChange={(e) => onFormDataChange({ ...formData, state: e.target.value })}
                placeholder="Provincia"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="postal_code">Código Postal</Label>
              <Input
                id="postal_code"
                value={formData.postal_code}
                onChange={(e) => onFormDataChange({ ...formData, postal_code: e.target.value })}
                placeholder="28001"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pais">País</Label>
              <Input
                id="pais"
                value={formData.pais}
                onChange={(e) => onFormDataChange({ ...formData, pais: e.target.value })}
                placeholder="España"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="franchisee_id">Franquiciado</Label>
              <Select
                value={formData.franchisee_id || undefined}
                onValueChange={(val) => onFormDataChange({ ...formData, franchisee_id: val })}
              >
                <SelectTrigger id="franchisee_id">
                  <SelectValue placeholder="Seleccionar franquiciado" />
                </SelectTrigger>
                <SelectContent>
                  {franchisees.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="seating_capacity">Capacidad (personas)</Label>
              <Input
                id="seating_capacity"
                type="number"
                value={formData.seating_capacity || ""}
                onChange={(e) =>
                  onFormDataChange({
                    ...formData,
                    seating_capacity: e.target.value ? parseInt(e.target.value) : null,
                  })
                }
                placeholder="Ej: 50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="square_meters">M² Superficie</Label>
              <Input
                id="square_meters"
                type="number"
                step="0.01"
                value={formData.square_meters || ""}
                onChange={(e) =>
                  onFormDataChange({
                    ...formData,
                    square_meters: e.target.value ? parseFloat(e.target.value) : null,
                  })
                }
                placeholder="Ej: 150.5"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="opening_date">Fecha Apertura</Label>
            <Input
              id="opening_date"
              type="date"
              value={formData.opening_date || ""}
              onChange={(e) => onFormDataChange({ ...formData, opening_date: e.target.value })}
            />
          </div>

          <div className="border-t pt-4 space-y-4">
            <h3 className="font-semibold text-sm">Configuración Orquest</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="orquest_business_id">Business ID</Label>
                <Input
                  id="orquest_business_id"
                  value={formData.orquest_business_id}
                  onChange={(e) =>
                    onFormDataChange({ ...formData, orquest_business_id: e.target.value })
                  }
                  placeholder="Ej: B001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="orquest_service_id">Service ID</Label>
                <Input
                  id="orquest_service_id"
                  value={formData.orquest_service_id}
                  onChange={(e) =>
                    onFormDataChange({ ...formData, orquest_service_id: e.target.value })
                  }
                  placeholder="Ej: S001"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Los services también se pueden configurar en la pestaña "Services Orquest"
            </p>
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
