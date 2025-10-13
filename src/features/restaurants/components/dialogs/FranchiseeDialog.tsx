import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import type { FranchiseeFormData } from "../../types";

interface FranchiseeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: FranchiseeFormData;
  onFormDataChange: (data: FranchiseeFormData) => void;
  isEditing: boolean;
  isSaving: boolean;
  onSubmit: () => void;
}

export const FranchiseeDialog = ({
  open,
  onOpenChange,
  formData,
  onFormDataChange,
  isEditing,
  isSaving,
  onSubmit,
}: FranchiseeDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Franquiciado" : "Nuevo Franquiciado"}
          </DialogTitle>
          <DialogDescription>
            Gestiona la información del propietario/franquiciado del restaurante
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
            <Label htmlFor="franchisee_name">
              Nombre <span className="text-red-500">*</span>
            </Label>
            <Input
              id="franchisee_name"
              value={formData.name}
              onChange={(e) => onFormDataChange({ ...formData, name: e.target.value })}
              placeholder="Nombre completo del franquiciado"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="franchisee_email">
              Email <span className="text-red-500">*</span>
            </Label>
            <Input
              id="franchisee_email"
              type="email"
              value={formData.email}
              onChange={(e) => onFormDataChange({ ...formData, email: e.target.value })}
              placeholder="email@example.com"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="franchisee_tax_id">CIF/NIF</Label>
            <Input
              id="franchisee_tax_id"
              value={formData.company_tax_id}
              onChange={(e) => onFormDataChange({ ...formData, company_tax_id: e.target.value })}
              placeholder="A12345678"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="orquest_api_key">API Key de Orquest</Label>
            <Input
              id="orquest_api_key"
              type="password"
              value={formData.orquest_api_key || ''}
              onChange={(e) => onFormDataChange({ 
                ...formData, 
                orquest_api_key: e.target.value || undefined 
              })}
              placeholder="Bearer Token de Orquest"
            />
            <p className="text-xs text-muted-foreground">
              API Key proporcionada por Orquest. Dejar en blanco usará autenticación global.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="orquest_business_id">Business ID de Orquest</Label>
            <Input
              id="orquest_business_id"
              value={formData.orquest_business_id || 'MCDONALDS_ES'}
              onChange={(e) => onFormDataChange({ 
                ...formData, 
                orquest_business_id: e.target.value || 'MCDONALDS_ES' 
              })}
              placeholder="MCDONALDS_ES"
            />
            <p className="text-xs text-muted-foreground">
              ID del negocio en Orquest (por defecto: MCDONALDS_ES)
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
