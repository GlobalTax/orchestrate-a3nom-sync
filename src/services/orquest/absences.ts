import { callOrquestAPI } from "./base";

export interface AbsenceParams {
  startDate: string;
  endDate: string;
  employeeId?: string;
}

/**
 * Get absences from Orquest
 * @param params - Parámetros de búsqueda
 * @param franchiseeId - (Opcional) ID del franquiciado para usar su API Key
 */
export async function getAbsences(params: AbsenceParams, franchiseeId?: string) {
  const query: Record<string, string> = {
    startDate: params.startDate,
    endDate: params.endDate,
  };

  if (params.employeeId) query.employeeId = params.employeeId;

  return callOrquestAPI({
    path: '/api/absences',
    method: 'GET',
    query,
    franchiseeId,
  });
}
