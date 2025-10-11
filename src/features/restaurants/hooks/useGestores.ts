import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { UserWithRoles, GestorAssignment } from "../types";

export const useGestores = (isAdmin: boolean) => {
  const queryClient = useQueryClient();

  const { data: usersWithRoles = [], isLoading } = useQuery({
    queryKey: ["users_with_roles"],
    queryFn: async () => {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*");
      
      if (profilesError) {
        console.error("[useGestores] Error fetching profiles:", profilesError);
        toast.error("Error al cargar perfiles: " + profilesError.message);
        throw profilesError;
      }

      const { data: userRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("*");
      
      if (rolesError) {
        console.error("[useGestores] Error fetching user roles:", rolesError);
        toast.error("Error al cargar roles: " + rolesError.message);
        throw rolesError;
      }

      return (profiles || []).map(profile => ({
        id: profile.id,
        email: profile.email || "",
        nombre: profile.nombre || "",
        apellidos: profile.apellidos || "",
        roles: userRoles?.filter(ur => ur.user_id === profile.id) || [],
      })) as UserWithRoles[];
    },
    enabled: isAdmin,
    retry: 2,
  });

  const assignMutation = useMutation({
    mutationFn: async ({ userId, centroCodigo }: { userId: string; centroCodigo: string }) => {
      const { error } = await supabase
        .from("user_roles")
        .insert({
          user_id: userId,
          role: "gestor",
          centro: centroCodigo,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users_with_roles"] });
      toast.success("Gestor asignado correctamente");
    },
    onError: (error: any) => {
      toast.error("Error al asignar gestor: " + error.message);
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (roleId: string) => {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("id", roleId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users_with_roles"] });
      toast.success("Gestor removido correctamente");
    },
    onError: (error: any) => {
      toast.error("Error al remover gestor: " + error.message);
    },
  });

  const autoAssignMutation = useMutation({
    mutationFn: async () => {
      toast.info("Iniciando asignación automática...");
      const { data, error } = await supabase.functions.invoke("assign_franchisees");
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`✅ ${data.created_users} usuarios creados, ${data.roles_assigned} roles asignados`);
      queryClient.invalidateQueries({ queryKey: ["users_with_roles"] });
    },
    onError: (error: any) => {
      toast.error("Error: " + error.message);
    },
  });

  // Group gestores by centro
  const gestoresByCentro = usersWithRoles.reduce((acc, user) => {
    const gestorRoles = user.roles.filter(r => r.role === "gestor");
    gestorRoles.forEach(role => {
      if (role.centro) {
        if (!acc[role.centro]) {
          acc[role.centro] = [];
        }
        acc[role.centro].push({
          userId: user.id,
          email: user.email,
          nombre: user.nombre,
          apellidos: user.apellidos,
          roleId: role.id,
        });
      }
    });
    return acc;
  }, {} as Record<string, GestorAssignment[]>);

  return {
    usersWithRoles,
    gestoresByCentro,
    isLoading,
    assignGestor: assignMutation.mutate,
    isAssigning: assignMutation.isPending,
    removeGestor: removeMutation.mutate,
    isRemoving: removeMutation.isPending,
    autoAssign: autoAssignMutation.mutate,
    isAutoAssigning: autoAssignMutation.isPending,
  };
};
