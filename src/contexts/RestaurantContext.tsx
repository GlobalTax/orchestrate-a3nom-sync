import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";

export interface Restaurant {
  id: string;
  codigo: string;
  nombre: string;
  direccion: string | null;
  ciudad: string | null;
  state: string | null;
  pais: string;
  postal_code: string | null;
  site_number: string | null;
  orquest_service_id: string | null;
  orquest_business_id: string | null;
  activo: boolean;
  franchisee_id: string | null;
  franchisee_name: string | null;
  franchisee_email: string | null;
  company_tax_id: string | null;
  seating_capacity: number | null;
  square_meters: number | null;
  opening_date: string | null;
  created_at: string;
  updated_at: string;
}

interface RestaurantContextType {
  selectedRestaurant: Restaurant | null;
  setSelectedRestaurant: (restaurant: Restaurant | null) => void;
  restaurants: Restaurant[];
  isLoading: boolean;
  isRestaurantSelected: () => boolean;
  getCurrentRestaurantCode: () => string | null;
  showInactive: boolean;
  setShowInactive: (value: boolean) => void;
}

const RestaurantContext = createContext<RestaurantContextType | undefined>(undefined);

const STORAGE_KEY = "selected_restaurant_id";
const SHOW_INACTIVE_KEY = "show_inactive_centres";

export const RestaurantProvider = ({ children }: { children: ReactNode }) => {
  const { centros, isAdmin, loading: roleLoading } = useUserRole();
  const [selectedRestaurant, setSelectedRestaurantState] = useState<Restaurant | null>(null);
  
  const [showInactive, setShowInactiveState] = useState<boolean>(() => {
    const saved = localStorage.getItem(SHOW_INACTIVE_KEY);
    return saved === 'true';
  });

  // Fetch all accessible restaurants
  const { data: restaurants = [], isLoading: restaurantsLoading } = useQuery({
    queryKey: ['restaurants_context', centros, isAdmin, showInactive],
    queryFn: async () => {
      const userType = isAdmin ? 'ADMIN' : 'GESTOR';
      
      console.log(`[RestaurantContext] 🔍 Fetching as ${userType}`, {
        isAdmin,
        centros,
        centrosCount: centros.length
      });

      if (!isAdmin && centros.length === 0) {
        console.warn('[RestaurantContext] Gestor sin centros asignados, retornando array vacío');
        return [];
      }

      // PASO 1: Contar restaurantes en la BD según el filtro actual
      let countQuery = supabase
        .from('centres')
        .select('*', { count: 'exact', head: true });
      
      if (!showInactive) {
        countQuery = countQuery.eq('activo', true);
      }
      
      const { count: totalDb, error: countError } = await countQuery;

      if (countError) {
        console.error('[RestaurantContext] ❌ Error counting centres:', countError);
      } else {
        console.log(`[RestaurantContext] 📊 Total en BD (${showInactive ? 'todos' : 'solo activos'}): ${totalDb}`);
      }

      // PASO 2: Ejecutar query principal
      const normalizados = centros.map(c => c.trim().toUpperCase());
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

      if (!isAdmin && normalizados.length > 0) {
        console.log(`[RestaurantContext] 🔒 Aplicando filtro gestor con centros:`, normalizados);
        query = query.in('codigo', normalizados);
      }

      const { data, error } = await query.order('nombre');
      
      if (error) {
        console.error('[RestaurantContext] ❌ Error fetching centres:', error);
        toast.error('Error al cargar restaurantes', {
          description: error.message
        });
        throw error;
      }

      const rawCount = data?.length || 0;
      console.log(`[RestaurantContext] 📦 Query devolvió ${rawCount} filas (antes de filtro manual)`);

      // PASO 3: Mapear datos
      let allRestaurants = (data || []).map((c) => ({
        id: c.id,
        codigo: c.codigo,
        nombre: c.nombre || '',
        direccion: c.direccion,
        ciudad: c.ciudad,
        state: c.state,
        pais: c.pais || 'España',
        postal_code: c.postal_code,
        site_number: c.site_number,
        orquest_service_id: c.orquest_service_id,
        orquest_business_id: c.orquest_business_id,
        activo: c.activo,
        franchisee_id: c.franchisee_id,
        franchisee_name: (c as Record<string, unknown>).franchisee_name as string ?? null,
        franchisee_email: (c as Record<string, unknown>).franchisee_email as string ?? null,
        company_tax_id: (c as Record<string, unknown>).company_tax_id as string ?? null,
        seating_capacity: typeof c.seating_capacity === 'string' ? parseInt(c.seating_capacity) : c.seating_capacity ?? null,
        square_meters: typeof c.square_meters === 'string' ? parseFloat(c.square_meters) : c.square_meters ?? null,
        opening_date: c.opening_date ?? null,
        created_at: c.created_at || new Date().toISOString(),
        updated_at: c.updated_at || new Date().toISOString(),
      })) as Restaurant[];

      // PASO 4: Filtro adicional para gestores
      const beforeFilterCount = allRestaurants.length;
      
      if (!isAdmin && normalizados.length > 0) {
        allRestaurants = allRestaurants.filter(r => 
          normalizados.includes(r.codigo?.trim().toUpperCase())
        );
        
        const afterFilterCount = allRestaurants.length;
        console.log(`[RestaurantContext] 🔍 Filtro manual: ${beforeFilterCount} → ${afterFilterCount} restaurantes`);
        
        if (beforeFilterCount !== afterFilterCount) {
          console.warn(`[RestaurantContext] ⚠️ El filtro manual eliminó ${beforeFilterCount - afterFilterCount} restaurantes`);
        }
      }

      // PASO 5: DIAGNÓSTICO (logs only, no toasts in data fetching)
      const finalCount = allRestaurants.length;
      const filterStatus = showInactive ? 'todos (activos + inactivos)' : 'solo activos';

      if (isAdmin) {
        console.log(`[RestaurantContext] Admin ve ${finalCount} de ${totalDb} restaurantes (${filterStatus})`);
      } else {
        console.log(`[RestaurantContext] Gestor ve ${finalCount} restaurantes (${filterStatus}, filtrado por ${centros.length} centros)`);
      }
      return allRestaurants;
    },
    enabled: !roleLoading,
    retry: 2,
  });

  // Restore selected restaurant from localStorage on mount
  useEffect(() => {
    if (restaurants.length === 0) return;

    const savedId = localStorage.getItem(STORAGE_KEY);
    
    if (savedId) {
      const restaurant = restaurants.find(r => r.id === savedId);
      if (restaurant) {
        setSelectedRestaurantState(restaurant);
        return;
      }
    }

    // Auto-select if user only has access to one restaurant
    if (!isAdmin && restaurants.length === 1) {
      setSelectedRestaurantState(restaurants[0]);
    }
  }, [restaurants, isAdmin]);

  const setSelectedRestaurant = (restaurant: Restaurant | null) => {
    setSelectedRestaurantState(restaurant);
    if (restaurant) {
      localStorage.setItem(STORAGE_KEY, restaurant.id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const isRestaurantSelected = () => selectedRestaurant !== null;
  
  const getCurrentRestaurantCode = () => selectedRestaurant?.codigo || null;

  const setShowInactive = (value: boolean) => {
    setShowInactiveState(value);
    localStorage.setItem(SHOW_INACTIVE_KEY, value.toString());
  };

  const isLoading = roleLoading || restaurantsLoading;

  return (
    <RestaurantContext.Provider
      value={{
        selectedRestaurant,
        setSelectedRestaurant,
        restaurants,
        isLoading,
        isRestaurantSelected,
        getCurrentRestaurantCode,
        showInactive,
        setShowInactive,
      }}
    >
      {children}
    </RestaurantContext.Provider>
  );
};

export const useRestaurant = () => {
  const context = useContext(RestaurantContext);
  if (!context) {
    throw new Error("useRestaurant must be used within RestaurantProvider");
  }
  return context;
};
