import { callOrquestAPI } from "./base";

export interface AbsenceParams {
  startDate: string;
  endDate: string;
  employeeId?: string;
}

/**
 * Get absences from Orquest
 */
export async function getAbsences(params: AbsenceParams) {
  const query: Record<string, string> = {
    startDate: params.startDate,
    endDate: params.endDate,
  };

  if (params.employeeId) query.employeeId = params.employeeId;

  return callOrquestAPI({
    path: '/api/absences',
    method: 'GET',
    query
  });
}
