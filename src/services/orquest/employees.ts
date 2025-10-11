import { callOrquestAPI } from "./base";

/**
 * Get employees by service from Orquest
 */
export async function getEmployeesByService(serviceId: string) {
  return callOrquestAPI({
    path: `/api/employees/service/${serviceId}`,
    method: 'GET'
  });
}

/**
 * Get all employees from Orquest
 */
export async function getAllEmployees() {
  return callOrquestAPI({
    path: '/api/employees',
    method: 'GET'
  });
}
