import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { RestaurantWithFranchisee } from "../types";

export const useRestaurantsDirect = (showInactive: boolean) => {
  const { data: restaurants = [], isLoading, error } = useQuery({
    queryKey: ["restaurants_direct", showInactive],
    queryFn: async () => {
      console.info("[useRestaurantsDirect] 🔍 Fetching via DIRECT query to centres");
      
      // Contar total en BD
      let countQuery = supabase
        .from('centres')
        .select('*', { count: 'exact', head: true });
      
      if (!showInactive) {
        countQuery = countQuery.eq('activo', true);
      }
      
      const { count: totalDb, error: countError } = await countQuery;
      
      if (countError) {
        console.error("[useRestaurantsDirect] ❌ Error counting:", countError);
      } else {
        console.info(`[useRestaurantsDirect] 📊 Total en BD (${showInactive ? 'todos' : 'solo activos'}): ${totalDb}`);
      }

      // Query principal SIN filtro por centros (admin ve todo)
      let query = supabase
        .from('centres')
        .select(`
          id, codigo, nombre, direccion, ciudad, state, pais, postal_code,
          site_number, orquest_service_id, orquest_business_id, activo,
          franchisee_id, franchisee_name, franchisee_email, company_tax_id,
          seating_capacity, square_meters, opening_date, created_at, updated_at
        `);

      if (!showInactive) {
        query = query.eq('activo', true);
      }

      const { data, error } = await query.order('nombre');
      
      if (error) {
        console.error("[useRestaurantsDirect] ❌ Error:", error);
        toast.error("Error al cargar restaurantes (Direct)", {
          description: error.message
        });
        throw error;
      }

      const fetchedCount = data?.length || 0;
      console.info(`[useRestaurantsDirect] ✅ Query devolvió: ${fetchedCount} restaurantes`);

      toast.success(`✅ Direct: ${fetchedCount} restaurantes cargados (${showInactive ? 'todos' : 'solo activos'})`, {
        duration: 3000,
      });

      // Mapear a formato RestaurantWithFranchisee
      return (data || []).map((c) => ({
        id: c.id,
        codigo: c.codigo,
        nombre: c.nombre || '',
        direccion: c.direccion,
        ciudad: c.ciudad,
        pais: c.pais || 'España',
        orquest_service_id: c.orquest_service_id,
        orquest_business_id: c.orquest_business_id,
        activo: c.activo,
        franchisee_id: c.franchisee_id,
        franchisee_name: c.franchisee_name,
        franchisee_email: c.franchisee_email,
        company_tax_id: c.company_tax_id,
        postal_code: c.postal_code,
        state: c.state,
        site_number: c.site_number,
        seating_capacity: c.seating_capacity,
        square_meters: c.square_meters,
        opening_date: c.opening_date,
      })) as RestaurantWithFranchisee[];
    },
    retry: 2,
  });

  return {
    restaurants,
    isLoading,
    error,
  };
};
