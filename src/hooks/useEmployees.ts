import { useQuery } from "@tanstack/react-query";
import { EmployeesService, Employee } from "@/services/api/employees.service";

export const useEmployees = () => {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["employees"],
    queryFn: EmployeesService.getAll,
  });

  return {
    employees: data ?? [],
    isLoading,
    error,
    refetch,
  };
};

export const useEmployeesByCentro = (centro: string) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["employees", centro],
    queryFn: () => EmployeesService.getByCentro(centro),
    enabled: !!centro,
  });

  return {
    employees: data ?? [],
    isLoading,
    error,
  };
};

export const useEmployee = (id: string) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["employee", id],
    queryFn: () => EmployeesService.getById(id),
    enabled: !!id,
  });

  return {
    employee: data,
    isLoading,
    error,
  };
};
