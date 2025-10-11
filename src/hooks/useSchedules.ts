import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SchedulesService, Schedule, ScheduleFilters } from "@/services/api/schedules.service";
import { toast } from "sonner";

export const useSchedules = (filters?: ScheduleFilters) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["schedules", filters],
    queryFn: () => SchedulesService.getAll(filters),
  });

  return {
    schedules: data ?? [],
    isLoading,
    error,
  };
};

export const useSchedulesByEmployee = (employeeId: string, startDate?: string, endDate?: string) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["schedules", employeeId, startDate, endDate],
    queryFn: () => SchedulesService.getByEmployee(employeeId, startDate, endDate),
    enabled: !!employeeId,
  });

  return {
    schedules: data ?? [],
    isLoading,
    error,
  };
};

export const useScheduleMutations = () => {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (schedule: Omit<Schedule, "id">) => SchedulesService.create(schedule),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      toast.success("Turno creado correctamente");
    },
    onError: (error: Error) => {
      toast.error("Error al crear turno: " + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, schedule }: { id: string; schedule: Partial<Schedule> }) =>
      SchedulesService.update(id, schedule),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      toast.success("Turno actualizado correctamente");
    },
    onError: (error: Error) => {
      toast.error("Error al actualizar turno: " + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => SchedulesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      toast.success("Turno eliminado correctamente");
    },
    onError: (error: Error) => {
      toast.error("Error al eliminar turno: " + error.message);
    },
  });

  const bulkCreateMutation = useMutation({
    mutationFn: (schedules: Omit<Schedule, "id">[]) => SchedulesService.bulkCreate(schedules),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      toast.success("Turnos creados correctamente");
    },
    onError: (error: Error) => {
      toast.error("Error al crear turnos: " + error.message);
    },
  });

  return {
    create: createMutation,
    update: updateMutation,
    delete: deleteMutation,
    bulkCreate: bulkCreateMutation,
  };
};
