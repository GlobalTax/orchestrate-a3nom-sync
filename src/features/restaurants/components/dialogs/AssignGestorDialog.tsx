import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { UserWithRoles } from "../../types";

interface AssignGestorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: UserWithRoles[];
  selectedCentro: string;
  onAssign: (userId: string, centroCodigo: string) => void;
}

export const AssignGestorDialog = ({
  open,
  onOpenChange,
  users,
  selectedCentro,
  onAssign,
}: AssignGestorDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Asignar Gestor</DialogTitle>
          <DialogDescription>
            Selecciona un usuario para darle acceso como gestor del restaurante
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Seleccionar Usuario</Label>
            <Select
              onValueChange={(userId) => {
                if (userId && selectedCentro) {
                  onAssign(userId, selectedCentro);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un usuario" />
              </SelectTrigger>
              <SelectContent>
                {users
                  .filter(user => {
                    const existingAssignment = user.roles.find(
                      r => r.role === "gestor" && r.centro === selectedCentro
                    );
                    return !existingAssignment;
                  })
                  .map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.nombre} {user.apellidos} ({user.email})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
