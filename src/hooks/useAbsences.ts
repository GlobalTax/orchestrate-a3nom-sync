import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Absence {
  id: string;
  employee_id: string;
  fecha: string;
  horas_ausencia: number;
  tipo: string;
  motivo: string | null;
}

export interface AbsenceFilters {
  startDate?: string;
  endDate?: string;
  employeeId?: string;
  centro?: string;
}

export const useAbsences = (filters?: AbsenceFilters) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["absences", filters],
    queryFn: async () => {
      let query = supabase
        .from("absences")
        .select(`
          *,
          employees:employee_id (
            nombre,
            apellidos,
            centro
          )
        `)
        .order("fecha", { ascending: false });

      if (filters?.startDate) {
        query = query.gte("fecha", filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte("fecha", filters.endDate);
      }
      if (filters?.employeeId) {
        query = query.eq("employee_id", filters.employeeId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  return {
    absences: data ?? [],
    isLoading,
    error,
  };
};

export const useAbsenceMutations = () => {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (absence: Omit<Absence, "id">) => {
      const { error } = await supabase.from("absences").insert([absence]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["absences"] });
      toast.success("Ausencia registrada correctamente");
    },
    onError: (error: Error) => {
      toast.error("Error al registrar ausencia: " + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, absence }: { id: string; absence: Partial<Absence> }) => {
      const { error } = await supabase
        .from("absences")
        .update(absence)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["absences"] });
      toast.success("Ausencia actualizada correctamente");
    },
    onError: (error: Error) => {
      toast.error("Error al actualizar ausencia: " + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("absences").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["absences"] });
      toast.success("Ausencia eliminada correctamente");
    },
    onError: (error: Error) => {
      toast.error("Error al eliminar ausencia: " + error.message);
    },
  });

  return {
    create: createMutation,
    update: updateMutation,
    delete: deleteMutation,
  };
};
