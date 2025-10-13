import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Franchisee, FranchiseeFormData } from "../types";

export const useFranchisees = (isAdmin: boolean) => {
  const queryClient = useQueryClient();

  const { data: franchisees = [], isLoading } = useQuery({
    queryKey: ["franchisees"],
    queryFn: async () => {
      console.info("[useFranchisees] Fetching franchisees");
      const { data, error } = await supabase
        .from("franchisees")
        .select("*")
        .order("name");
      if (error) {
        console.error("[useFranchisees] Error:", error);
        toast.error("Error al cargar franquiciados: " + error.message);
        throw error;
      }
      console.info("[useFranchisees] Fetched count:", data?.length || 0);
      return data as Franchisee[];
    },
    enabled: isAdmin,
    retry: 2,
  });

  const saveMutation = useMutation({
    mutationFn: async ({ data, editingId }: { data: FranchiseeFormData; editingId?: string }) => {
      // Limpiar campos vacíos (convertir "" a null)
      const cleanData = {
        ...data,
        orquest_api_key: data.orquest_api_key?.trim() || null,
        orquest_business_id: data.orquest_business_id?.trim() || 'MCDONALDS_ES',
      };

      if (editingId) {
        const { error } = await supabase
          .from("franchisees")
          .update(cleanData)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("franchisees")
          .insert([cleanData]);
        if (error) throw error;
      }
    },
    onSuccess: (_, { editingId }) => {
      queryClient.invalidateQueries({ queryKey: ["franchisees"] });
      queryClient.invalidateQueries({ queryKey: ["restaurants_with_franchisees"] });
      toast.success(editingId ? "Franquiciado actualizado" : "Franquiciado creado");
    },
    onError: (error: any) => {
      toast.error("Error: " + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("franchisees")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["franchisees"] });
      queryClient.invalidateQueries({ queryKey: ["restaurants_with_franchisees"] });
      toast.success("Franquiciado eliminado");
    },
    onError: (error: any) => {
      toast.error("Error: " + error.message);
    },
  });

  return {
    franchisees,
    isLoading,
    save: saveMutation.mutate,
    isSaving: saveMutation.isPending,
    deleteFranchisee: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
  };
};
