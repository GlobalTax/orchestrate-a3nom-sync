import { z } from "zod";

/**
 * Validation schemas for restaurant-related data
 */

export const restaurantSchema = z.object({
  codigo: z.string().min(1, "Código requerido"),
  nombre: z.string().min(1, "Nombre requerido"),
  direccion: z.string().optional().nullable(),
  ciudad: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  pais: z.string().default("España"),
  postal_code: z.string().optional().nullable(),
  franchisee_id: z.string().uuid().nullable().optional(),
  seating_capacity: z.number().int().positive().optional().nullable(),
  square_meters: z.number().positive().optional().nullable(),
  opening_date: z.string().optional().nullable(),
});

export const franchiseeSchema = z.object({
  name: z.string().min(1, "Nombre requerido"),
  email: z.string().email("Email inválido"),
  company_tax_id: z.string().optional().nullable(),
});

export const serviceSchema = z.object({
  centro_id: z.string().uuid("Centro ID inválido"),
  orquest_service_id: z.string().min(1, "Service ID requerido"),
  descripcion: z.string().optional().nullable(),
  activo: z.boolean().default(true),
});

export const costCentreSchema = z.object({
  centro_id: z.string().uuid("Centro ID inválido"),
  a3_centro_code: z.string().min(1, "Código A3 requerido"),
  descripcion: z.string().optional().nullable(),
  activo: z.boolean().default(true),
});

export type RestaurantInput = z.infer<typeof restaurantSchema>;
export type FranchiseeInput = z.infer<typeof franchiseeSchema>;
export type ServiceInput = z.infer<typeof serviceSchema>;
export type CostCentreInput = z.infer<typeof costCentreSchema>;

/**
 * Validate restaurant data
 */
export const validateRestaurant = (data: unknown) => {
  return restaurantSchema.safeParse(data);
};

/**
 * Validate franchisee data
 */
export const validateFranchisee = (data: unknown) => {
  return franchiseeSchema.safeParse(data);
};

/**
 * Validate service data
 */
export const validateService = (data: unknown) => {
  return serviceSchema.safeParse(data);
};

/**
 * Validate cost centre data
 */
export const validateCostCentre = (data: unknown) => {
  return costCentreSchema.safeParse(data);
};
