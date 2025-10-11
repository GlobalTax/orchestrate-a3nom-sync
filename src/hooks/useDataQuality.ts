import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

export interface DQIssue {
  id: string;
  tipo: string;
  severidad: "critica" | "alta" | "media" | "baja";
  employee_id: string | null;
  periodo_inicio: string;
  periodo_fin: string;
  centro: string | null;
  detalle: any;
  resuelto: boolean;
  resuelto_por: string | null;
  resuelto_at: string | null;
  created_at: string;
}

export interface DQFilters {
  startDate: Date;
  endDate: Date;
  centro?: string;
  severidad?: string;
  estado?: "all" | "pending" | "resolved";
}

export const useDataQualityIssues = (filters: DQFilters) => {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["dq-issues", filters],
    queryFn: async () => {
      let query = supabase
        .from("dq_issues")
        .select("*")
        .gte("periodo_inicio", format(filters.startDate, "yyyy-MM-dd"))
        .lte("periodo_fin", format(filters.endDate, "yyyy-MM-dd"))
        .order("created_at", { ascending: false });

      if (filters.centro) {
        query = query.eq("centro", filters.centro);
      }

      if (filters.severidad && filters.severidad !== "all") {
        query = query.eq("severidad", filters.severidad as "critica" | "alta" | "media" | "baja");
      }

      if (filters.estado === "pending") {
        query = query.eq("resuelto", false);
      } else if (filters.estado === "resolved") {
        query = query.eq("resuelto", true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as DQIssue[];
    },
  });

  return {
    issues: data ?? [],
    isLoading,
    error,
    refetch,
  };
};

export const useDataQualityMutations = () => {
  const queryClient = useQueryClient();

  const recalculateMutation = useMutation({
    mutationFn: async ({ startDate, endDate, centro }: { startDate: Date; endDate: Date; centro?: string }) => {
      const { data, error } = await supabase.rpc("detect_dq_issues", {
        p_start_date: format(startDate, "yyyy-MM-dd"),
        p_end_date: format(endDate, "yyyy-MM-dd"),
        p_centro: centro || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["dq-issues"] });
      toast.success(`Análisis completado. Se detectaron ${data[0]?.issues_detected || 0} incidencias`);
    },
    onError: (error: Error) => {
      toast.error("Error al recalcular: " + error.message);
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async (issueId: string) => {
      const { error } = await supabase
        .from("dq_issues")
        .update({
          resuelto: true,
          resuelto_at: new Date().toISOString(),
        })
        .eq("id", issueId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dq-issues"] });
      toast.success("Incidencia marcada como resuelta");
    },
    onError: (error: Error) => {
      toast.error("Error al resolver: " + error.message);
    },
  });

  return {
    recalculate: recalculateMutation,
    resolve: resolveMutation,
  };
};
