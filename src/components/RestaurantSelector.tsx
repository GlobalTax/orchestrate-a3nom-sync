import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCentro } from "@/contexts/CentroContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Building2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * RestaurantSelector
 * 
 * Enhanced global restaurant selector that displays:
 * - Format: [codigo] nombre (e.g., [MAD-001] Restaurant Madrid)
 * - Auto-selection for users with only 1 restaurant
 * - Hidden for admin users
 */
export const RestaurantSelector = () => {
  const { selectedCentro, setSelectedCentro, availableCentros } = useCentro();
  const { isAdmin, loading: roleLoading } = useUserRole();

  // Fetch restaurant details for display
  const { data: restaurantData, isLoading } = useQuery({
    queryKey: ['restaurants_selector', availableCentros],
    queryFn: async () => {
      if (availableCentros.length === 0) return {};

      const { data, error } = await supabase
        .from('centres')
        .select('codigo, nombre, orquest_business_id')
        .eq('activo', true)
        .in('codigo', availableCentros);
      
      if (error) throw error;
      
      // Convert to indexed object
      return data.reduce((acc, r) => {
        acc[r.codigo] = r;
        return acc;
      }, {} as Record<string, typeof data[0]>);
    },
    enabled: availableCentros.length > 0 && !isAdmin,
  });

  // Admin doesn't need selector
  if (isAdmin) return null;

  // If only has 1 restaurant, show fixed badge
  if (availableCentros.length === 1) {
    const centro = availableCentros[0];
    const restaurantInfo = restaurantData?.[centro];

    return (
      <div className="flex items-center gap-2 text-sm">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <Badge variant="secondary" className="gap-1 font-mono">
          {centro}
        </Badge>
        {restaurantInfo && (
          <span className="text-muted-foreground">{restaurantInfo.nombre}</span>
        )}
      </div>
    );
  }

  // If has >1, show selector
  if (roleLoading || isLoading) {
    return <Skeleton className="h-10 w-[280px]" />;
  }

  return (
    <Select value={selectedCentro || ""} onValueChange={setSelectedCentro}>
      <SelectTrigger className="w-[280px]">
        <SelectValue placeholder="Seleccionar restaurante">
          {selectedCentro && restaurantData?.[selectedCentro] && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs font-mono">
                {selectedCentro}
              </Badge>
              <span>{restaurantData[selectedCentro].nombre}</span>
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {availableCentros.map((centro) => (
          <SelectItem key={centro} value={centro}>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs font-mono">
                {centro}
              </Badge>
              <span>{restaurantData?.[centro]?.nombre || centro}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
