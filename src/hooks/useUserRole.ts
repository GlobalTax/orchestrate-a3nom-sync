import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "franquiciado" | "gestor" | "asesoria";

interface UserRoleData {
  roles: AppRole[];
  centros: string[];
  franchiseeId: string | null;
  userId: string | null;
}

export const useUserRole = () => {
  const [authTrigger, setAuthTrigger] = useState(0);

  // Listen to auth changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      setAuthTrigger(prev => prev + 1);
    });

    return () => subscription.unsubscribe();
  }, []);

  const { data, isLoading: loading } = useQuery<UserRoleData>({
    queryKey: ['user_role', authTrigger],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        return {
          roles: [],
          centros: [],
          franchiseeId: null,
          userId: null,
        };
      }

      // Fetch user roles with franchisee_id (explicitly filter by user)
      const { data: userRoles, error } = await supabase
        .from("user_roles")
        .select("role, centro, franchisee_id")
        .eq("user_id", user.id) as any;

      if (error) throw error;

      const uniqueRoles = [...new Set(userRoles?.map((r: any) => r.role as AppRole) || [])] as AppRole[];

      // Extract franchisee_id if exists
      const franchiseeRole = userRoles?.find((r: any) => r.franchisee_id);
      const franchiseeId = franchiseeRole?.franchisee_id || null;

      // Fetch accessible centros from view
      const { data: userCentres } = await supabase
        .from("v_user_centres")
        .select("centro_code")
        .eq("user_id", user.id);

      const accessibleCentros = userCentres?.map(c => c.centro_code) || [];

      console.log('[useUserRole] 🔐 User roles loaded:', {
        userId: user.id,
        email: user.email,
        roles: uniqueRoles,
        centros: accessibleCentros,
        franchiseeId,
        isAdmin: uniqueRoles.includes('admin'),
        isFranquiciado: uniqueRoles.includes('franquiciado'),
        isGestor: uniqueRoles.includes('gestor'),
        isAsesoria: uniqueRoles.includes('asesoria'),
      });

      return {
        roles: uniqueRoles,
        centros: accessibleCentros,
        franchiseeId,
        userId: user.id,
      };
    },
    staleTime: 0, // No caché, siempre refetch
    gcTime: 10 * 60 * 1000, // 10 minutos (antes cacheTime)
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
  
  // Asesoría only has read access
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
