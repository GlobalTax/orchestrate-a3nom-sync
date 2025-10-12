import { Building2, MapPin, Users, Wifi } from "lucide-react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

export const RestaurantSelector = () => {
  const { selectedRestaurant, setSelectedRestaurant, restaurants, isLoading: contextLoading } = useRestaurant();
  const { isAdmin } = useUserRole();

  console.log('[RestaurantSelector] Rendering with:', {
    restaurantsCount: restaurants.length,
    selectedRestaurant: selectedRestaurant?.nombre,
    isLoading: contextLoading,
    isAdmin
  });

  // Get employee count for selected restaurant
  const { data: employeeCount } = useQuery({
    queryKey: ['employee_count', selectedRestaurant?.codigo],
    queryFn: async () => {
      if (!selectedRestaurant?.codigo) return 0;
      
      const { count, error } = await supabase
        .from("employees")
        .select("*", { count: 'exact', head: true })
        .eq("centro", selectedRestaurant.codigo)
        .is("fecha_baja", null);
      
      if (error) throw error;
      return count || 0;
    },
    enabled: !!selectedRestaurant?.codigo,
  });

  if (contextLoading) {
    return <Skeleton className="h-16 w-[320px]" />;
  }

  const handleValueChange = (value: string) => {
    if (value === "all") {
      setSelectedRestaurant(null);
    } else {
      const restaurant = restaurants.find(r => r.id === value);
      if (restaurant) {
        setSelectedRestaurant(restaurant);
      }
    }
  };

  return (
    <div className="flex items-center gap-3">
      <Select
        value={selectedRestaurant?.id || "all"}
        onValueChange={handleValueChange}
      >
        <SelectTrigger className="w-[320px] h-auto py-2">
          <div className="flex items-start gap-3 w-full">
            <Building2 className="h-5 w-5 mt-0.5 shrink-0 text-primary" />
            <div className="flex flex-col items-start gap-1 min-w-0 flex-1">
              {selectedRestaurant ? (
                <>
                  <span className="font-semibold text-sm truncate w-full text-left">
                    {selectedRestaurant.nombre}
                  </span>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {selectedRestaurant.ciudad && (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        <span>{selectedRestaurant.ciudad}</span>
                      </div>
                    )}
                    {employeeCount !== undefined && (
                      <>
                        <span>•</span>
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          <span>{employeeCount} empleados</span>
                        </div>
                      </>
                    )}
                  </div>
                </>
              ) : (
                <SelectValue placeholder="Seleccionar restaurante" />
              )}
            </div>
          </div>
        </SelectTrigger>
        <SelectContent className="w-[320px]">
          {isAdmin && (
            <>
              <SelectItem value="all">
                <div className="flex items-center gap-2 py-1">
                  <Building2 className="h-4 w-4" />
                  <span className="font-medium">Todos los restaurantes</span>
                </div>
              </SelectItem>
              <Separator className="my-2" />
            </>
          )}
          {restaurants.map((restaurant) => (
            <SelectItem key={restaurant.id} value={restaurant.id}>
              <div className="flex flex-col gap-1 py-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs font-mono shrink-0">
                    {restaurant.codigo}
                  </Badge>
                  <span className="font-medium">{restaurant.nombre}</span>
                  {restaurant.orquest_service_id && (
                    <Wifi className="h-3 w-3 text-success" />
                  )}
                </div>
                {restaurant.ciudad && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground ml-[68px]">
                    <MapPin className="h-3 w-3" />
                    <span>{restaurant.ciudad}</span>
                  </div>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      {selectedRestaurant && (
        <Badge variant="secondary" className="gap-1 shrink-0">
          <Building2 className="h-3 w-3" />
          Activo
        </Badge>
      )}
    </div>
  );
};
