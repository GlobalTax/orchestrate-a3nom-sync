import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { RestaurantWithFranchisee, RestaurantFormData } from "../types";

export const useRestaurants = (isAdmin: boolean) => {
  const queryClient = useQueryClient();

  const { data: restaurants = [], isLoading, error } = useQuery({
    queryKey: ["restaurants_with_franchisees"],
    queryFn: async () => {
      console.info("[useRestaurants] Fetching via RPC get_restaurants_with_franchisees");
      const { data, error } = await supabase.rpc("get_restaurants_with_franchisees");
      
      if (error) {
        console.error("[useRestaurants] Error:", error);
        toast.error("Error al cargar restaurantes: " + error.message);
        throw error;
      }

      console.info("[useRestaurants] Fetched count:", data?.length || 0);
      return (data || []).map(r => ({
        id: r.id,
        codigo: r.site_number || r.id,
        nombre: r.name || "",
        direccion: r.address,
        ciudad: r.city,
        pais: r.country || "España",
        orquest_service_id: null,
        orquest_business_id: null,
        activo: true,
        franchisee_id: r.franchisee_id,
        franchisee_name: r.franchisee_name,
        franchisee_email: r.franchisee_email,
        company_tax_id: r.company_tax_id,
        postal_code: r.postal_code,
        state: r.state,
        site_number: r.site_number,
        seating_capacity: r.seating_capacity ? parseInt(r.seating_capacity) : null,
        square_meters: r.square_meters ? parseFloat(r.square_meters) : null,
        opening_date: r.opening_date,
      })) as RestaurantWithFranchisee[];
    },
    enabled: isAdmin,
    retry: 2,
  });

  const saveMutation = useMutation({
    mutationFn: async ({ data, editingId }: { data: RestaurantFormData; editingId?: string }) => {
      const restaurantData = {
        codigo: data.codigo,
        nombre: data.nombre,
        direccion: data.direccion,
        ciudad: data.ciudad,
        state: data.state,
        pais: data.pais,
        postal_code: data.postal_code,
        site_number: data.site_number,
        franchisee_id: data.franchisee_id,
        seating_capacity: data.seating_capacity || null,
        square_meters: data.square_meters || null,
        opening_date: data.opening_date,
      };

      if (editingId) {
        const { error } = await supabase
          .from("centres")
          .update(restaurantData)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("centres")
          .insert([restaurantData]);
        if (error) throw error;
      }
    },
    onSuccess: (_, { editingId }) => {
      queryClient.invalidateQueries({ queryKey: ["restaurants_with_franchisees"] });
      queryClient.invalidateQueries({ queryKey: ["centres"] });
      toast.success(editingId ? "Restaurante actualizado" : "Restaurante creado");
    },
    onError: (error: any) => {
      toast.error("Error al guardar: " + error.message);
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const restaurant = restaurants.find(r => r.id === id);
      if (!restaurant) return;
      const { error } = await supabase
        .from("centres")
        .update({ activo: !restaurant.activo })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["centres"] });
      toast.success("Estado actualizado");
    },
    onError: (error: any) => {
      toast.error("Error: " + error.message);
    },
  });

  const testConnection = async (centreId: string) => {
    const centre = restaurants.find(c => c.id === centreId);
    if (!centre) return;

    try {
      const { data, error } = await supabase.functions.invoke("test_orquest_connection", {
        body: {
          service_id: centre.orquest_service_id,
          business_id: centre.orquest_business_id,
        },
      });

      if (error) throw error;

      if (data.success) {
        toast.success(`✅ Conexión exitosa: ${data.employees_count} empleados encontrados`);
      } else {
        toast.error("Error en la conexión: " + data.message);
      }
    } catch (error: any) {
      toast.error("Error al probar conexión: " + error.message);
    }
  };

  return {
    restaurants,
    isLoading,
    error,
    save: saveMutation.mutate,
    isSaving: saveMutation.isPending,
    toggleActive: toggleActiveMutation.mutate,
    isTogglingActive: toggleActiveMutation.isPending,
    testConnection,
  };
};
