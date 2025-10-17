import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Copy, CheckCircle2 } from "lucide-react";

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  franchisees: Array<{ id: string; name: string }>;
}

export const InviteUserDialog = ({ open, onOpenChange, franchisees }: InviteUserDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    email: "",
    role: "" as "admin" | "franquiciado" | "gestor" | "asesoria" | "",
    centro: "",
    franchisee_id: "",
  });

  const handleSubmit = async () => {
    if (!formData.email || !formData.role) {
      toast.error("Email y rol son obligatorios");
      return;
    }

    if (formData.role === "asesoria" && !formData.centro) {
      toast.error("El rol Asesoría requiere un centro asignado");
      return;
    }

    if (["franquiciado", "gestor"].includes(formData.role) && !formData.franchisee_id) {
      toast.error("Los roles Franquiciado y Gestor requieren una franquicia");
      return;
    }

    try {
      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke("send_invite", {
        body: {
          email: formData.email,
          role: formData.role,
          centro: formData.role === "asesoria" ? formData.centro : undefined,
          franchisee_id: ["franquiciado", "gestor"].includes(formData.role) ? formData.franchisee_id : undefined,
        },
      });

      if (error) throw error;

      setInviteLink(data.inviteLink);
      toast.success("Invitación creada correctamente");
    } catch (error: any) {
      console.error("Error al crear invitación:", error);
      toast.error(error.message || "Error al crear la invitación");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink);
      toast.success("Link copiado al portapapeles");
    }
  };

  const handleClose = () => {
    setInviteLink(null);
    setFormData({
      email: "",
      role: "",
      centro: "",
      franchisee_id: "",
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Invitar Nuevo Usuario</DialogTitle>
          <DialogDescription>
            {inviteLink 
              ? "Invitación creada. Comparte este link con el usuario."
              : "Completa los datos para enviar una invitación"
            }
          </DialogDescription>
        </DialogHeader>

        {inviteLink ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-4 bg-muted rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-medium">Link de invitación:</p>
                <p className="text-xs text-muted-foreground break-all">{inviteLink}</p>
              </div>
            </div>
            <Button onClick={handleCopyLink} className="w-full gap-2">
              <Copy className="h-4 w-4" />
              Copiar Link
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="usuario@ejemplo.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Rol *</Label>
              <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value as any })}>
                <SelectTrigger id="role">
                  <SelectValue placeholder="Seleccionar rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="franquiciado">Franquiciado</SelectItem>
                  <SelectItem value="gestor">Gestor</SelectItem>
                  <SelectItem value="asesoria">Asesoría</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(formData.role === "franquiciado" || formData.role === "gestor") && (
              <div className="space-y-2">
                <Label htmlFor="franchisee">Franquicia *</Label>
                <Select value={formData.franchisee_id} onValueChange={(value) => setFormData({ ...formData, franchisee_id: value })}>
                  <SelectTrigger id="franchisee">
                    <SelectValue placeholder="Seleccionar franquicia" />
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
            )}

            {formData.role === "asesoria" && (
              <div className="space-y-2">
                <Label htmlFor="centro">Centro *</Label>
                <Input
                  id="centro"
                  placeholder="Código del centro (ej: REST001)"
                  value={formData.centro}
                  onChange={(e) => setFormData({ ...formData, centro: e.target.value })}
                />
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {inviteLink ? (
            <Button onClick={handleClose}>Cerrar</Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Crear Invitación
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
