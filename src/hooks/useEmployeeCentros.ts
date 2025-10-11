import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useEmployeeCentros = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["centros"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_centros");
      if (error) throw error;
      return data?.map((c: { centro: string }) => c.centro) || [];
    },
  });

  return {
    centros: data ?? [],
    isLoading,
    error,
  };
};
