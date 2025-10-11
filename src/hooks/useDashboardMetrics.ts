import { useQuery } from "@tanstack/react-query";
import { CostsService } from "@/services/api/costs.service";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";

interface ServiceMetrics {
  service_id: string;
  service_descripcion: string;
  horas_planificadas: number;
  horas_trabajadas: number;
  empleados_activos: number;
}

export const useDashboardMetrics = (
  startDate: Date,
  endDate: Date,
  centro: string
) => {
  const startDateStr = format(startDate, "yyyy-MM-dd");
  const endDateStr = format(endDate, "yyyy-MM-dd");
  const centroParam = centro === "all" ? null : centro;

  // Fetch hours metrics
  const { data: hoursMetrics, isLoading: loadingHours } = useQuery({
    queryKey: ["hours-metrics", startDateStr, endDateStr, centro],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_hours_metrics", {
        p_start_date: startDateStr,
        p_end_date: endDateStr,
        p_centro: centroParam,
      });
      if (error) throw error;
      return data?.[0] || null;
    },
  });

  // Fetch cost metrics
  const { data: costMetrics, isLoading: loadingCost } = useQuery({
    queryKey: ["cost-metrics", startDateStr, endDateStr, centro],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_cost_metrics", {
        p_start_date: startDateStr,
        p_end_date: endDateStr,
        p_centro: centroParam,
      });
      if (error) throw error;
      return data?.[0] || null;
    },
  });

  // Fetch daily evolution
  const { data: dailyData, isLoading: loadingDaily } = useQuery({
    queryKey: ["daily-evolution", startDateStr, endDateStr, centro],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_daily_hours_evolution", {
        p_start_date: startDateStr,
        p_end_date: endDateStr,
        p_centro: centroParam,
      });
      if (error) throw error;
      return data?.map((d: any) => ({
        fecha: format(new Date(d.fecha), "dd/MM", { locale: es }),
        horas_planificadas: Number(d.horas_planificadas) || 0,
        horas_trabajadas: Number(d.horas_trabajadas) || 0,
        horas_ausencia: Number(d.horas_ausencia) || 0,
      })) || [];
    },
  });

  // Fetch service metrics
  const { data: serviceMetrics, isLoading: loadingServices } = useQuery({
    queryKey: ["service-metrics", startDateStr, endDateStr, centro],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_metrics_by_service", {
        p_start_date: startDateStr,
        p_end_date: endDateStr,
        p_centro_code: centroParam,
      });
      if (error) throw error;
      return data || [];
    },
  });

  return {
    hoursMetrics,
    costMetrics,
    dailyData,
    serviceMetrics: serviceMetrics as ServiceMetrics[],
    isLoading: loadingHours || loadingCost || loadingDaily || loadingServices,
  };
};
