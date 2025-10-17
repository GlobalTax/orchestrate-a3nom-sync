import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "franquiciado" | "gestor" | "asesoria";

export const useUserRole = () => {
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [centros, setCentros] = useState<string[]>([]);
  const [franchiseeId, setFranchiseeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserRoles = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setRoles([]);
          setUserId(null);
          setLoading(false);
          return;
        }

        setUserId(user.id);

        // Fetch user roles with franchisee_id
        const { data: userRoles, error } = await supabase
          .from("user_roles")
          .select("role, centro, franchisee_id") as any;

        if (error) throw error;

        const uniqueRoles = [...new Set(userRoles?.map((r: any) => r.role as AppRole) || [])] as AppRole[];
        setRoles(uniqueRoles);

        // Extract franchisee_id if exists
        const franchiseeRole = userRoles?.find((r: any) => r.franchisee_id);
        if (franchiseeRole) {
          setFranchiseeId(franchiseeRole.franchisee_id);
        }

        // Fetch accessible centros from view
        const { data: userCentres } = await supabase
          .from("v_user_centres")
          .select("centro_code")
          .eq("user_id", user.id);

        const accessibleCentros = userCentres?.map(c => c.centro_code) || [];
        setCentros(accessibleCentros);

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
      } catch (error) {
        console.error("Error fetching user roles:", error);
        setRoles([]);
      } finally {
        setLoading(false);
      }
    };

    fetchUserRoles();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchUserRoles();
    });

    return () => subscription.unsubscribe();
  }, []);

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
