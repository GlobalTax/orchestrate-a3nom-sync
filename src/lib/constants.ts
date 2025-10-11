/**
 * Application-wide constants
 */

export const APP_NAME = "Orquest + A3Nom";

export const DATE_FORMATS = {
  SHORT: "DD/MM/YYYY",
  LONG: "DD [de] MMMM [de] YYYY",
  WITH_TIME: "DD/MM/YYYY HH:mm",
  ISO: "YYYY-MM-DD",
  TIME: "HH:mm",
} as const;

export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 50,
  PAGE_SIZE_OPTIONS: [20, 50, 100],
} as const;

export const ABSENCE_TYPES = {
  VACATION: "Vacaciones",
  SICK_LEAVE: "Baja médica",
  PERSONAL: "Asunto personal",
  TRAINING: "Formación",
  OTHER: "Otro",
} as const;

export const DATA_QUALITY_SEVERITY = {
  CRITICAL: "critica",
  HIGH: "alta",
  MEDIUM: "media",
  LOW: "baja",
} as const;

export const USER_ROLES = {
  ADMIN: "admin",
  GESTOR: "gestor",
  VIEWER: "viewer",
} as const;

export const CACHE_DURATION = {
  SHORT: 5 * 60 * 1000, // 5 minutes
  MEDIUM: 30 * 60 * 1000, // 30 minutes
  LONG: 6 * 60 * 60 * 1000, // 6 hours
} as const;

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
} as const;

export const TOAST_DURATION = {
  SHORT: 2000,
  MEDIUM: 4000,
  LONG: 6000,
} as const;

export const ORQUEST_CONFIG = {
  MAX_RETRIES: 3,
  INITIAL_RETRY_DELAY: 1000,
  CACHE_VALIDITY_HOURS: 6,
} as const;

export const VALIDATION = {
  MIN_PASSWORD_LENGTH: 8,
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_FILE_TYPES: ['.xlsx', '.xls', '.csv'],
} as const;
