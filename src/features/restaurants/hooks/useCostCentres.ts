import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { CostCentre, CostCentreFormData } from "../types";

export const useCostCentres = (isAdmin: boolean) => {
  const queryClient = useQueryClient();

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
      if (error) {
        console.error("[useCostCentres] Error:", error);
        toast.error("Error al cargar centros de coste: " + error.message);
        throw error;
      }
      return data as CostCentre[];
    },
    enabled: isAdmin,
    retry: 2,
  });

  const saveMutation = useMutation({
    mutationFn: async ({ data, editingId }: { data: CostCentreFormData; editingId?: string }) => {
      if (editingId) {
        const { error } = await supabase
          .from("restaurant_cost_centres")
          .update(data)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("restaurant_cost_centres")
          .insert([{ ...data, activo: true }]);
        if (error) throw error;
      }
    },
    onSuccess: (_, { editingId }) => {
      queryClient.invalidateQueries({ queryKey: ["cost_centres"] });
      toast.success(editingId ? "Centro de coste actualizado" : "Centro de coste creado");
    },
    onError: (error: any) => {
      toast.error("Error: " + error.message);
    },
  });

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

  return {
    costCentres,
    isLoading,
    save: saveMutation.mutate,
    isSaving: saveMutation.isPending,
    toggleActive: toggleActiveMutation.mutate,
    isTogglingActive: toggleActiveMutation.isPending,
  };
};
