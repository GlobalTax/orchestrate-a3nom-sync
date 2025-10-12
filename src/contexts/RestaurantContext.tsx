import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";

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
}

const RestaurantContext = createContext<RestaurantContextType | undefined>(undefined);

const STORAGE_KEY = "selected_restaurant_id";

export const RestaurantProvider = ({ children }: { children: ReactNode }) => {
  const { centros, isAdmin, loading: roleLoading } = useUserRole();
  const [selectedRestaurant, setSelectedRestaurantState] = useState<Restaurant | null>(null);

  // Fetch all accessible restaurants
  const { data: restaurants = [], isLoading: restaurantsLoading } = useQuery({
    queryKey: ['restaurants_context', centros, isAdmin],
    queryFn: async () => {
      if (!isAdmin && centros.length === 0) return [];
      
      console.log('[RestaurantContext] Fetching restaurants. isAdmin:', isAdmin, 'centros:', centros);
      
      // Use RPC that joins centres with franchisees
      const { data, error } = await supabase.rpc("get_restaurants_with_franchisees");
      
      if (error) {
        console.error('[RestaurantContext] Error fetching restaurants:', error);
        throw error;
      }

      console.log('[RestaurantContext] Raw data from RPC:', data?.length || 0, 'restaurants');
      
      // Map to Restaurant type
      let allRestaurants = (data || []).map(r => ({
        id: r.id,
        codigo: r.site_number || r.id,
        nombre: r.name || "",
        direccion: r.address,
        ciudad: r.city,
        state: r.state,
        pais: r.country || "España",
        postal_code: r.postal_code,
        site_number: r.site_number,
        orquest_service_id: null,
        orquest_business_id: null,
        activo: true,
        franchisee_id: r.franchisee_id,
        franchisee_name: r.franchisee_name,
        franchisee_email: r.franchisee_email,
        company_tax_id: r.company_tax_id,
        seating_capacity: r.seating_capacity ? parseInt(r.seating_capacity) : null,
        square_meters: r.square_meters ? parseFloat(r.square_meters) : null,
        opening_date: r.opening_date,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })) as Restaurant[];

      // Filter by accessible centres if not admin
      if (!isAdmin && centros.length > 0) {
        allRestaurants = allRestaurants.filter(r => centros.includes(r.codigo));
        console.log('[RestaurantContext] Filtered to accessible centres:', allRestaurants.length);
      }

      console.log('[RestaurantContext] Returning', allRestaurants.length, 'restaurants');
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
