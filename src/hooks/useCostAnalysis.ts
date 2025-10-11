import { useQuery } from "@tanstack/react-query";
import { CostsService, PayrollCost, PlannedVsActualCost } from "@/services/api/costs.service";
import { CostCalculations } from "@/lib/calculations/costCalculations";
import { format } from "date-fns";

export const useCostAnalysis = (
  startDate: Date,
  endDate: Date,
  centro: string
) => {
  const startDateStr = format(startDate, "yyyy-MM-dd");
  const endDateStr = format(endDate, "yyyy-MM-dd");
  const centroParam = centro === "all" ? null : centro;

  // Fetch payroll costs
  const { data: payrollData, isLoading: loadingPayroll } = useQuery({
    queryKey: ["payroll-costs", startDateStr, endDateStr, centro],
    queryFn: () =>
      CostsService.getPayrollCosts(startDateStr, endDateStr, centroParam || undefined),
  });

  // Fetch planned vs actual costs
  const { data: comparisonData, isLoading: loadingComparison } = useQuery({
    queryKey: ["planned-vs-actual", startDateStr, endDateStr, centro],
    queryFn: () =>
      CostsService.getPlannedVsActualCosts(startDateStr, endDateStr, centroParam || undefined),
  });

  // Calculate summary statistics
  const totalHorasTrabajadas = payrollData?.reduce(
    (sum, item) => sum + Number(item.horas_trabajadas),
    0
  ) || 0;

  const totalCoste = payrollData?.reduce(
    (sum, item) => sum + Number(item.coste_total),
    0
  ) || 0;

  const totalHorasVacaciones = payrollData?.reduce(
    (sum, item) => sum + Number(item.horas_vacaciones),
    0
  ) || 0;

  const totalHorasFormacion = payrollData?.reduce(
    (sum, item) => sum + Number(item.horas_formacion),
    0
  ) || 0;

  const costeMedio = CostCalculations.calculateHourlyCost(
    totalCoste,
    totalHorasTrabajadas
  );

  // Calculate variance
  const totalPlanned = comparisonData?.reduce(
    (sum, item) => sum + Number(item.costes_planificados),
    0
  ) || 0;

  const totalActual = comparisonData?.reduce(
    (sum, item) => sum + Number(item.costes_reales),
    0
  ) || 0;

  const variance = CostCalculations.calculateVariance(totalActual, totalPlanned);

  return {
    payrollData: payrollData || [],
    comparisonData: comparisonData || [],
    summary: {
      totalHorasTrabajadas,
      totalCoste,
      totalHorasVacaciones,
      totalHorasFormacion,
      costeMedio,
      totalPlanned,
      totalActual,
      variance,
    },
    isLoading: loadingPayroll || loadingComparison,
  };
};
