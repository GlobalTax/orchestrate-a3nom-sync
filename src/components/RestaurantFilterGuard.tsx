import { ReactNode } from "react";
import { useCentro } from "@/contexts/CentroContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Building2, AlertTriangle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface RestaurantFilterGuardProps {
  children: ReactNode;
  requireSelection?: boolean;
}

/**
 * RestaurantFilterGuard
 * 
 * Security component that protects routes ensuring:
 * 1. User has at least 1 restaurant assigned
 * 2. If user has >1, they must select one before viewing data
 * 3. Admin can view everything without restrictions
 * 
 * @param requireSelection - If true, blocks access until selection is made (default: true)
 */
export const RestaurantFilterGuard = ({ 
  children, 
  requireSelection = true 
}: RestaurantFilterGuardProps) => {
  const { selectedCentro, setSelectedCentro, availableCentros } = useCentro();
  const { isAdmin, loading } = useUserRole();

  // Admin can view everything without filter
  if (isAdmin) return <>{children}</>;

  // Loading state
  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="text-muted-foreground">Cargando permisos...</div>
      </div>
    );
  }

  // If no restaurants assigned
  if (availableCentros.length === 0) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Sin Acceso a Restaurantes</AlertTitle>
          <AlertDescription>
            No tienes permisos asignados a ningún restaurante. 
            Contacta con el administrador.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // If has 1 restaurant, it's auto-selected (done by CentroContext)
  if (availableCentros.length === 1) {
    return <>{children}</>;
  }

  // If has >1 restaurants and no selection
  if (requireSelection && !selectedCentro) {
    return (
      <div className="p-6 space-y-6">
        <Alert>
          <Building2 className="h-4 w-4" />
          <AlertTitle>Selecciona un Restaurante</AlertTitle>
          <AlertDescription>
            Tienes acceso a múltiples restaurantes. Selecciona uno para continuar.
          </AlertDescription>
        </Alert>

        <div className="max-w-md">
          <label className="text-sm font-medium mb-2 block">Restaurante:</label>
          <Select value={selectedCentro || ""} onValueChange={setSelectedCentro}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona un restaurante" />
            </SelectTrigger>
            <SelectContent>
              {availableCentros.map((centro) => (
                <SelectItem key={centro} value={centro}>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-xs">
                      {centro}
                    </Badge>
                    <span>Restaurante {centro}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  }

  // All OK, show content
  return <>{children}</>;
};
