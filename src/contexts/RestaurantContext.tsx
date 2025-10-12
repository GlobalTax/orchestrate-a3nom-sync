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
      
      let query = supabase
        .from("centres")
        .select("*")
        .eq("activo", true);
      
      // Filter by accessible centres for non-admins
      if (!isAdmin && centros.length > 0) {
        query = query.in("codigo", centros);
      }
      
      const { data, error } = await query.order("nombre");
      
      if (error) throw error;
      
      return (data || []).map(c => ({
        ...c,
        created_at: c.created_at || new Date().toISOString(),
        updated_at: c.updated_at || new Date().toISOString(),
      })) as Restaurant[];
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
