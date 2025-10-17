/**
 * Global type definitions
 */

// Common API response types
export interface ApiResponse<T> {
  data: T;
  error?: string;
  status: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Common entity types
export interface BaseEntity {
  id: string;
  created_at: string;
  updated_at?: string;
}

// Date range type
export interface DateRange {
  start: Date | string;
  end: Date | string;
}

// Filter types
export interface Filter {
  field: string;
  operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "like" | "in";
  value: any;
}

export interface SortConfig {
  column: string;
  direction: "asc" | "desc";
}

// Query params
export interface QueryParams {
  search?: string;
  filters?: Filter[];
  sort?: SortConfig;
  page?: number;
  pageSize?: number;
}

// Form states
export type FormMode = "create" | "edit" | "view";

export interface FormState {
  mode: FormMode;
  isSubmitting: boolean;
  isDirty: boolean;
  errors: Record<string, string>;
}

// User role type (must match database enum)
export type UserRole = "admin" | "franquiciado" | "gestor" | "asesoria";

// User role with additional details
export interface UserRoleWithDetails {
  id: string;
  user_id: string;
  role: UserRole;
  centro?: string;
  franchisee_id?: string;
  created_at: string;
}

// Data quality severity (must match database enum)
export type DQSeverity = "critica" | "alta" | "media" | "baja";

// Notification type
export interface Notification {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}
