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
 */
export async function getAssignments(params: AssignmentParams) {
  const query: Record<string, string> = {
    startDate: params.startDate,
    endDate: params.endDate,
  };

  if (params.serviceId) query.serviceId = params.serviceId;
  if (params.employeeId) query.employeeId = params.employeeId;

  return callOrquestAPI({
    path: '/api/assignments',
    method: 'GET',
    query
  });
}

/**
 * Create or update an assignment in Orquest
 */
export async function saveAssignment(assignment: AssignmentData) {
  return callOrquestAPI({
    path: '/api/assignments',
    method: 'POST',
    body: assignment
  });
}

/**
 * Delete an assignment from Orquest
 */
export async function deleteAssignment(assignmentId: string) {
  return callOrquestAPI({
    path: `/api/assignments/${assignmentId}`,
    method: 'DELETE'
  });
}
