import { z } from "zod";

/**
 * Validation schemas for employee-related data
 */

export const employeeSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido"),
  apellidos: z.string().min(1, "Apellidos requeridos"),
  email: z.string().email("Email inválido").optional().nullable(),
  centro: z.string().optional().nullable(),
  codtrabajador_a3nom: z.string().optional().nullable(),
  employee_id_orquest: z.string().optional().nullable(),
  fecha_alta: z.string().optional().nullable(),
  fecha_baja: z.string().optional().nullable(),
});

export const scheduleSchema = z.object({
  employee_id: z.string().uuid("Employee ID inválido"),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha debe estar en formato YYYY-MM-DD"),
  hora_inicio: z.string().regex(/^\d{2}:\d{2}$/, "Hora inicio debe estar en formato HH:mm"),
  hora_fin: z.string().regex(/^\d{2}:\d{2}$/, "Hora fin debe estar en formato HH:mm"),
  horas_planificadas: z.number().positive("Horas planificadas debe ser positivo"),
  service_id: z.string().optional().nullable(),
  tipo_asignacion: z.string().optional().nullable(),
});

export const absenceSchema = z.object({
  employee_id: z.string().uuid("Employee ID inválido"),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha debe estar en formato YYYY-MM-DD"),
  tipo: z.string().min(1, "Tipo requerido"),
  horas_ausencia: z.number().positive("Horas ausencia debe ser positivo"),
  motivo: z.string().optional().nullable(),
});

export type EmployeeInput = z.infer<typeof employeeSchema>;
export type ScheduleInput = z.infer<typeof scheduleSchema>;
export type AbsenceInput = z.infer<typeof absenceSchema>;

/**
 * Validate employee data
 */
export const validateEmployee = (data: unknown) => {
  return employeeSchema.safeParse(data);
};

/**
 * Validate schedule data
 */
export const validateSchedule = (data: unknown) => {
  return scheduleSchema.safeParse(data);
};

/**
 * Validate absence data
 */
export const validateAbsence = (data: unknown) => {
  return absenceSchema.safeParse(data);
};

/**
 * Validate that schedule hours match calculated hours
 */
export const validateScheduleHours = (
  startTime: string,
  endTime: string,
  plannedHours: number
): boolean => {
  const start = new Date(`2000-01-01 ${startTime}`);
  const end = new Date(`2000-01-01 ${endTime}`);
  
  // Handle shifts crossing midnight
  if (end < start) {
    end.setDate(end.getDate() + 1);
  }
  
  const calculatedHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  const tolerance = 0.1; // 6 minutes tolerance
  
  return Math.abs(calculatedHours - plannedHours) <= tolerance;
};
