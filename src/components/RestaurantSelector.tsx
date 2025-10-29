import { Building2, MapPin, Users, Wifi, Check, ChevronsUpDown } from "lucide-react";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { memo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export const RestaurantSelector = memo(() => {
  const { selectedRestaurant, setSelectedRestaurant, restaurants, isLoading: contextLoading } = useRestaurant();
  const { isAdmin } = useUserRole();
  const [open, setOpen] = useState(false);

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


  const handleSelect = (value: string) => {
    if (value === "all") {
      setSelectedRestaurant(null);
    } else {
      const restaurant = restaurants.find(r => r.id === value);
      if (restaurant) {
        setSelectedRestaurant(restaurant);
      }
    }
    setOpen(false);
  };

  return (
    <div className={cn("flex items-center gap-3 transition-opacity", contextLoading && "opacity-50")}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-[320px] h-auto py-2 justify-between"
          >
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
                  <span className="text-muted-foreground">Seleccionar restaurante</span>
                )}
              </div>
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar restaurante..." />
            <CommandList>
              <CommandEmpty>No se encontraron restaurantes.</CommandEmpty>
              <CommandGroup>
                {isAdmin && (
                  <>
                    <CommandItem
                      value="all"
                      onSelect={() => handleSelect("all")}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          !selectedRestaurant ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex items-center gap-2 py-1">
                        <Building2 className="h-4 w-4" />
                        <span className="font-medium">Todos los restaurantes</span>
                      </div>
                    </CommandItem>
                    <CommandSeparator className="my-2" />
                  </>
                )}
                {restaurants.map((restaurant) => (
                  <CommandItem
                    key={restaurant.id}
                    value={`${restaurant.codigo} ${restaurant.nombre} ${restaurant.ciudad || ''}`}
                    onSelect={() => handleSelect(restaurant.id)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedRestaurant?.id === restaurant.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col gap-1 py-1 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs font-mono shrink-0">
                          {restaurant.codigo}
                        </Badge>
                        <span className="font-medium truncate">{restaurant.nombre}</span>
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
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      
      {selectedRestaurant && (
        <Badge variant="secondary" className="gap-1 shrink-0">
          <Building2 className="h-3 w-3" />
          Activo
        </Badge>
      )}
    </div>
  );
});
