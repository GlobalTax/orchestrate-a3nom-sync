/**
 * @deprecated This file is deprecated. Use the new modular structure instead:
 * - import from "@/services/orquest" for Orquest API calls
 * - import from "@/services/api" for Supabase data services
 * 
 * This file is kept for backward compatibility only.
 */

// Re-export everything from the new modular structure
export {
  callOrquestAPI,
  getEmployeesByService,
  getAllEmployees,
  getAssignments,
  getAbsences,
  getServices,
  getServicesHybrid,
  updateServicesCache,
  saveAssignment,
  deleteAssignment,
} from "@/services/orquest";

export type { OrquestProxyRequest, AssignmentParams, AssignmentData, AbsenceParams } from "@/services/orquest";
