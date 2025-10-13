import { callOrquestAPI } from "./base";

/**
 * Get employees by service from Orquest
 * @param serviceId - ID del servicio de Orquest
 * @param franchiseeId - (Opcional) ID del franquiciado para usar su API Key
 */
export async function getEmployeesByService(serviceId: string, franchiseeId?: string) {
  return callOrquestAPI({
    path: `/api/employees/service/${serviceId}`,
    method: 'GET',
    franchiseeId,
  });
}

/**
 * Get all employees from Orquest
 * @param franchiseeId - (Opcional) ID del franquiciado para usar su API Key
 */
export async function getAllEmployees(franchiseeId?: string) {
  return callOrquestAPI({
    path: '/api/employees',
    method: 'GET',
    franchiseeId,
  });
}
