import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { EmployeesService } from "@/services/api/employees.service";
import { employeeSchema, type EmployeeInput } from "@/lib/validators/employeeValidators";

interface NewEmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  centros: string[];
}

export const NewEmployeeDialog = ({ open, onOpenChange, centros }: NewEmployeeDialogProps) => {
  const queryClient = useQueryClient();

  const today = new Date().toISOString().split("T")[0];

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<EmployeeInput>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      nombre: "",
      apellidos: "",
      email: "",
      centro: "",
      fecha_alta: today,
    },
  });

  const centroValue = watch("centro");

  const mutation = useMutation({
    mutationFn: (data: EmployeeInput) => EmployeesService.create(data as unknown as Omit<Employee, "id">),
    onSuccess: () => {
      toast.success("Empleado creado correctamente");
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      handleClose();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Error al crear el empleado");
    },
  });

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  const onSubmit = (data: EmployeeInput) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Nuevo Empleado</DialogTitle>
          <DialogDescription>
            Completa los datos para crear un nuevo empleado
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre *</Label>
            <Input
              id="nombre"
              placeholder="Nombre del empleado"
              {...register("nombre")}
            />
            {errors.nombre && (
              <p className="text-sm text-destructive">{errors.nombre.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="apellidos">Apellidos *</Label>
            <Input
              id="apellidos"
              placeholder="Apellidos del empleado"
              {...register("apellidos")}
            />
            {errors.apellidos && (
              <p className="text-sm text-destructive">{errors.apellidos.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="empleado@ejemplo.com"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="centro">Centro</Label>
            <Select
              value={centroValue || ""}
              onValueChange={(value) => setValue("centro", value)}
            >
              <SelectTrigger id="centro">
                <SelectValue placeholder="Seleccionar centro" />
              </SelectTrigger>
              <SelectContent>
                {centros.map((centro) => (
                  <SelectItem key={centro} value={centro}>
                    {centro}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fecha_alta">Fecha de Alta</Label>
            <Input
              id="fecha_alta"
              type="date"
              {...register("fecha_alta")}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Crear Empleado
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
