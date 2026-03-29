import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { useAuthReady } from "./useAuthReady";

export type AppRole = "admin" | "franquiciado" | "gestor" | "asesoria";

interface UserRoleData {
  roles: AppRole[];
  centros: string[];
  franchiseeId: string | null;
  userId: string | null;
}

export const useUserRole = () => {
  const { user, isReady } = useAuthReady();

  const { data, isLoading: loading } = useQuery<UserRoleData>({
    queryKey: ['user_role', user?.id],
    queryFn: async (): Promise<UserRoleData> => {
      if (!user) {
        return { roles: [], centros: [], franchiseeId: null, userId: null };
      }

      const { data: userRoles, error } = await supabase
        .from("user_roles")
        .select("role, centro, franchisee_id")
        .eq("user_id", user.id);

      if (error) throw error;

      const uniqueRoles = [...new Set((userRoles ?? []).map((r) => r.role as AppRole))];
      const franchiseeRole = (userRoles ?? []).find((r) => r.franchisee_id);
      const franchiseeId = franchiseeRole?.franchisee_id || null;

      const { data: userCentres } = await supabase
        .from("v_user_centres")
        .select("centro_code")
        .eq("user_id", user.id);

      const accessibleCentros = (userCentres?.map(c => c.centro_code) || []).filter((c): c is string => c != null);

      logger.info('useUserRole', 'User roles loaded', {
        userId: user.id,
        email: user.email,
        roles: uniqueRoles,
        centros: accessibleCentros,
        franchiseeId,
      });

      return {
        roles: uniqueRoles,
        centros: accessibleCentros,
        franchiseeId,
        userId: user.id,
      };
    },
    enabled: isReady && !!user,
    staleTime: 0,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  const roles = data?.roles || [];
  const centros = data?.centros || [];
  const franchiseeId = data?.franchiseeId || null;
  const userId = data?.userId || null;

  const hasRole = (role: AppRole) => roles.includes(role);
  const isAdmin = hasRole("admin");
  const isFranquiciado = hasRole("franquiciado");
  const isGestor = hasRole("gestor");
  const isAsesoria = hasRole("asesoria");
  const canWrite = isAdmin || isFranquiciado || isGestor;
  
  const canAccessCentro = (centro: string) => {
    return isAdmin || centros.includes(centro);
  };

  return {
    roles,
    centros,
    franchiseeId,
    loading,
    userId,
    hasRole,
    isAdmin,
    isFranquiciado,
    isGestor,
    isAsesoria,
    canWrite,
    canAccessCentro,
  };
};
