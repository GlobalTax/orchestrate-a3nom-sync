import { callOrquestAPI } from "./base";

export interface AssignmentParams {
  startDate: string;
  endDate: string;
  serviceId?: string;
  employeeId?: string;
}

export interface AssignmentData {
  employeeId: string;
  serviceId: string;
  date: string;
  startTime: string;
  endTime: string;
  hours: number;
}

/**
 * Get assignments (schedules) from Orquest
 * @param params - Parámetros de búsqueda
 * @param franchiseeId - (Opcional) ID del franquiciado para usar su API Key
 */
export async function getAssignments(params: AssignmentParams, franchiseeId?: string) {
  const query: Record<string, string> = {
    startDate: params.startDate,
    endDate: params.endDate,
  };

  if (params.serviceId) query.serviceId = params.serviceId;
  if (params.employeeId) query.employeeId = params.employeeId;

  return callOrquestAPI({
    path: '/api/assignments',
    method: 'GET',
    query,
    franchiseeId,
  });
}

/**
 * Create or update an assignment in Orquest
 * @param assignment - Datos de la asignación
 * @param franchiseeId - (Opcional) ID del franquiciado para usar su API Key
 */
export async function saveAssignment(assignment: AssignmentData, franchiseeId?: string) {
  return callOrquestAPI({
    path: '/api/assignments',
    method: 'POST',
    body: assignment,
    franchiseeId,
  });
}

/**
 * Delete an assignment from Orquest
 * @param assignmentId - ID de la asignación a eliminar
 * @param franchiseeId - (Opcional) ID del franquiciado para usar su API Key
 */
export async function deleteAssignment(assignmentId: string, franchiseeId?: string) {
  return callOrquestAPI({
    path: `/api/assignments/${assignmentId}`,
    method: 'DELETE',
    franchiseeId,
  });
}
