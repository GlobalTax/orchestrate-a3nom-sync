import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { RestaurantService, ServiceFormData } from "../types";

export const useServices = (isAdmin: boolean) => {
  const queryClient = useQueryClient();

  const { data: services = [], isLoading } = useQuery({
    queryKey: ["restaurant_services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurant_services")
        .select(`
          *,
          centres:centro_id (
            codigo,
            nombre
          )
        `)
        .order("created_at", { ascending: false });
      if (error) {
        console.error("[useServices] Error:", error);
        toast.error("Error al cargar servicios: " + error.message);
        throw error;
      }
      return data as RestaurantService[];
    },
    enabled: isAdmin,
    retry: 2,
  });

  const { data: servicesCount = {} } = useQuery({
    queryKey: ["services_count"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurant_services")
        .select("centro_id")
        .eq("activo", true);
      
      if (error) {
        console.error("[useServices] Error fetching count:", error);
        toast.error("Error al contar servicios: " + error.message);
        throw error;
      }
      
      return data.reduce((acc, curr) => {
        acc[curr.centro_id] = (acc[curr.centro_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
    },
    enabled: isAdmin,
    retry: 2,
  });

  const saveMutation = useMutation({
    mutationFn: async ({ data, editingId }: { data: ServiceFormData; editingId?: string }) => {
      if (editingId) {
        const { error } = await supabase
          .from("restaurant_services")
          .update(data)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("restaurant_services")
          .insert([data]);
        if (error) throw error;
      }
    },
    onSuccess: (_, { editingId }) => {
      queryClient.invalidateQueries({ queryKey: ["restaurant_services"] });
      queryClient.invalidateQueries({ queryKey: ["services_count"] });
      toast.success(editingId ? "Service actualizado" : "Service creado");
    },
    onError: (error: any) => {
      toast.error("Error: " + error.message);
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, activo }: { id: string; activo: boolean }) => {
      const { error } = await supabase
        .from("restaurant_services")
        .update({ activo })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restaurant_services"] });
      queryClient.invalidateQueries({ queryKey: ["services_count"] });
      toast.success("Estado actualizado");
    },
    onError: (error: any) => {
      toast.error("Error: " + error.message);
    },
  });

  // Group services by restaurant
  const servicesByRestaurant = services.reduce((acc, service) => {
    const key = service.centro_id;
    if (!acc[key]) {
      acc[key] = {
        restaurant: service.centres,
        services: [],
      };
    }
    acc[key].services.push(service);
    return acc;
  }, {} as Record<string, { restaurant: any; services: RestaurantService[] }>);

  return {
    services,
    servicesCount,
    servicesByRestaurant,
    isLoading,
    save: saveMutation.mutate,
    isSaving: saveMutation.isPending,
    toggleActive: toggleActiveMutation.mutate,
    isTogglingActive: toggleActiveMutation.isPending,
  };
};
