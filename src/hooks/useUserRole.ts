import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "gestor";

export const useUserRole = () => {
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [centros, setCentros] = useState<string[]>([]);
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

        const { data, error } = await supabase
          .from("user_roles")
          .select("role, centro")
          .eq("user_id", user.id);

        if (error) throw error;

        const userRoles = data?.map(r => r.role as AppRole) || [];
        const userCentros = data
          ?.filter(r => r.centro)
          .map(r => r.centro as string) || [];

        setRoles(userRoles);
        setCentros(userCentros);

        console.log('[useUserRole] 🔐 User roles loaded:', {
          userId: user.id,
          email: user.email,
          roles: userRoles,
          centros: userCentros,
          isAdmin: userRoles.includes('admin'),
          isGestor: userRoles.includes('gestor'),
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
  const isGestor = hasRole("gestor");
  const canAccessCentro = (centro: string) => {
    return isAdmin || centros.includes(centro);
  };

  return {
    roles,
    centros,
    loading,
    userId,
    hasRole,
    isAdmin,
    isGestor,
    canAccessCentro,
  };
};
