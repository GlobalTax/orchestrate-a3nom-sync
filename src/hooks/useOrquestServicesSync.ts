import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ServicesSyncLog {
  id: string;
  started_at: string;
  completed_at: string | null;
  status: 'running' | 'completed' | 'failed' | 'partial';
  total_franchisees: number;
  franchisees_succeeded: number;
  franchisees_failed: number;
  total_services: number;
  errors: any[];
  results: any[];
  trigger_source: 'manual' | 'cron';
}

export function useOrquestServicesSync() {
  const queryClient = useQueryClient();

  // Fetch logs
  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: ['orquest_services_sync_logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orquest_services_sync_logs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as ServicesSyncLog[];
    },
    refetchInterval: 10000, // Auto-refresh every 10s
  });

  // Execute sync mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('sincronizar-orquest-servicios');
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message || 'Sincronización de servicios completada');
      } else {
        toast.error(data.error || 'Error en la sincronización');
      }
      queryClient.invalidateQueries({ queryKey: ['orquest_services_sync_logs'] });
      queryClient.invalidateQueries({ queryKey: ['servicios_orquest'] });
      queryClient.invalidateQueries({ queryKey: ['orquest_services'] });
    },
    onError: (error: any) => {
      toast.error(`Error al sincronizar servicios: ${error.message}`);
    }
  });

  // Fetch servicios_orquest
  const { data: servicios, isLoading: serviciosLoading } = useQuery({
    queryKey: ['servicios_orquest'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('servicios_orquest')
        .select('*, franchisees(name)')
        .order('updated_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data;
    },
  });

  // Count total servicios
  const { data: serviciosCount } = useQuery({
    queryKey: ['servicios_orquest_count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('servicios_orquest')
        .select('*', { count: 'exact', head: true });

      if (error) throw error;
      return count || 0;
    },
  });

  // Count active franchisees
  const { data: activeFranchisees } = useQuery({
    queryKey: ['active_franchisees_count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('franchisees')
        .select('*', { count: 'exact', head: true })
        .not('orquest_api_key', 'is', null);

      if (error) throw error;
      return count || 0;
    },
  });

  return {
    logs,
    logsLoading,
    syncMutation,
    servicios,
    serviciosLoading,
    serviciosCount: serviciosCount || 0,
    activeFranchisees: activeFranchisees || 0,
  };
}
