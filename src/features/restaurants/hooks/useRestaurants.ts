import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import type { RestaurantWithFranchisee, RestaurantFormData } from "../types";

export const useRestaurants = (isAdmin: boolean) => {
  const queryClient = useQueryClient();

  const { data: restaurants = [], isLoading, error } = useQuery({
    queryKey: ["restaurants_with_franchisees"],
    queryFn: async () => {
      logger.info("useRestaurants", "Fetching restaurants as ADMIN via RPC");
      
      // Primero, contar cuántos restaurantes hay realmente en la BD
      const { count: totalInDb, error: countError } = await supabase
        .from('centres')
        .select('*', { count: 'exact', head: true })
        .eq('activo', true);

      if (countError) {
        logger.error("useRestaurants", "Error counting centres:", countError);
      } else {
        logger.info("useRestaurants", `Total restaurants in DB (activo=true): ${totalInDb}`);
      }

      // Ahora ejecutar la RPC
      const { data, error } = await supabase.rpc("get_restaurants_with_franchisees");
      
      if (error) {
        logger.error("useRestaurants", "RPC Error:", error);
        toast.error("Error al cargar restaurantes", {
          description: error.message
        });
        throw error;
      }

      const fetchedCount = data?.length || 0;
      logger.info("useRestaurants", `RPC returned: ${fetchedCount} restaurants`);

      // DIAGNÓSTICO CRÍTICO: Comparar RPC vs BD
      if (totalInDb && fetchedCount !== totalInDb) {
        const message = `⚠️ DISCREPANCIA DETECTADA: La RPC devolvió ${fetchedCount} restaurantes pero la BD tiene ${totalInDb} activos`;
        logger.warn("useRestaurants", message);
        
        toast.warning('⚠️ Problema de sincronización', {
          description: `RPC devolvió ${fetchedCount} pero hay ${totalInDb} en la BD. Puede ser necesario revisar migraciones o RLS policies.`,
          duration: 10000,
        });
      } else if (fetchedCount === 0 && totalInDb && totalInDb > 0) {
        const message = `🚨 CRÍTICO: La RPC devolvió 0 restaurantes pero hay ${totalInDb} en la BD`;
        logger.error("useRestaurants", message);
        
        toast.error('🚨 Error crítico de permisos', {
          description: `La función RPC no devuelve datos. Hay ${totalInDb} restaurantes en la BD pero no son accesibles. Revisa las políticas RLS y la función get_restaurants_with_franchisees().`,
          duration: 15000,
        });
      } else {
        toast.success(`✅ ${fetchedCount} restaurantes cargados correctamente`, {
          duration: 3000,
        });
      }

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
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error("Error al guardar: " + message);
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
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error("Error: " + message);
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
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error("Error al probar conexión: " + message);
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
