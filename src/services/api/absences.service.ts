import { supabase } from "@/integrations/supabase/client";

export interface Absence {
  id: string;
  employee_id: string;
  fecha: string;
  tipo: string;
  horas_ausencia: number;
  motivo?: string;
}

export interface AbsenceFilters {
  startDate?: string;
  endDate?: string;
  employeeId?: string;
  tipo?: string;
}

export class AbsencesService {
  static async getAll(filters?: AbsenceFilters): Promise<Absence[]> {
    let query = supabase
      .from("absences")
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
    if (filters?.tipo) {
      query = query.eq("tipo", filters.tipo);
    }

    const { data, error } = await query;
    
    if (error) throw error;
    return data || [];
  }

  static async getByEmployee(employeeId: string, startDate?: string, endDate?: string): Promise<Absence[]> {
    return this.getAll({ employeeId, startDate, endDate });
  }

  static async create(absence: Omit<Absence, "id">): Promise<void> {
    const { error } = await supabase
      .from("absences")
      .insert([absence]);
    
    if (error) throw error;
  }

  static async update(id: string, absence: Partial<Absence>): Promise<void> {
    const { error } = await supabase
      .from("absences")
      .update(absence)
      .eq("id", id);
    
    if (error) throw error;
  }

  static async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from("absences")
      .delete()
      .eq("id", id);
    
    if (error) throw error;
  }

  static async bulkCreate(absences: Omit<Absence, "id">[]): Promise<void> {
    const { error } = await supabase
      .from("absences")
      .insert(absences);
    
    if (error) throw error;
  }
}
