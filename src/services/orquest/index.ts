// Base client
export { callOrquestAPI } from "./base";
export type { OrquestProxyRequest } from "./base";

// Employees
export { 
  getEmployeesByService,
  getAllEmployees 
} from "./employees";

// Schedules (Assignments)
export { 
  getAssignments,
  saveAssignment,
  deleteAssignment 
} from "./schedules";
export type { AssignmentParams, AssignmentData } from "./schedules";

// Absences
export { getAbsences } from "./absences";
export type { AbsenceParams } from "./absences";

// Services
export { 
  getServices,
  getServicesHybrid,
  updateServicesCache 
} from "./services";
