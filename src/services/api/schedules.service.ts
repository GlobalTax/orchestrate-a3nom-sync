import { supabase } from "@/integrations/supabase/client";

export interface Schedule {
  id: string;
  employee_id: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  horas_planificadas: number;
  service_id?: string;
  tipo_asignacion?: string;
}

export interface ScheduleFilters {
  startDate?: string;
  endDate?: string;
  employeeId?: string;
  centro?: string;
}

export class SchedulesService {
  static async getAll(filters?: ScheduleFilters): Promise<Schedule[]> {
    let query = supabase
      .from("schedules")
      .select(`
        *,
        employees:employee_id (
          nombre,
          apellidos,
          centro
        )
      `)
      .order("fecha", { ascending: false });

    if (filters?.startDate) {
      query = query.gte("fecha", filters.startDate);
    }
    if (filters?.endDate) {
      query = query.lte("fecha", filters.endDate);
    }
    if (filters?.employeeId) {
      query = query.eq("employee_id", filters.employeeId);
    }

    const { data, error } = await query;
    
    if (error) throw error;
    return data || [];
  }

  static async getByEmployee(employeeId: string, startDate?: string, endDate?: string): Promise<Schedule[]> {
    return this.getAll({ employeeId, startDate, endDate });
  }

  static async create(schedule: Omit<Schedule, "id">): Promise<void> {
    const { error } = await supabase
      .from("schedules")
      .insert([schedule]);
    
    if (error) throw error;
  }

  static async update(id: string, schedule: Partial<Schedule>): Promise<void> {
    const { error } = await supabase
      .from("schedules")
      .update(schedule)
      .eq("id", id);
    
    if (error) throw error;
  }

  static async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from("schedules")
      .delete()
      .eq("id", id);
    
    if (error) throw error;
  }

  static async bulkCreate(schedules: Omit<Schedule, "id">[]): Promise<void> {
    const { error } = await supabase
      .from("schedules")
      .insert(schedules);
    
    if (error) throw error;
  }
}
