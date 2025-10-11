import { supabase } from "@/integrations/supabase/client";

export interface Employee {
  id: string;
  nombre: string;
  apellidos: string;
  email?: string;
  centro?: string;
  codtrabajador_a3nom?: string;
  employee_id_orquest?: string;
  fecha_alta?: string;
  fecha_baja?: string;
}

export class EmployeesService {
  static async getAll(): Promise<Employee[]> {
    const { data, error } = await supabase
      .from("employees")
      .select("*")
      .order("apellidos", { ascending: true });
    
    if (error) throw error;
    return data || [];
  }

  static async getByCentro(centro: string): Promise<Employee[]> {
    const { data, error } = await supabase
      .from("employees")
      .select("*")
      .eq("centro", centro)
      .order("apellidos", { ascending: true });
    
    if (error) throw error;
    return data || [];
  }

  static async getById(id: string): Promise<Employee | null> {
    const { data, error } = await supabase
      .from("employees")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    
    if (error) throw error;
    return data;
  }

  static async create(employee: Omit<Employee, "id">): Promise<void> {
    const { error } = await supabase
      .from("employees")
      .insert([employee]);
    
    if (error) throw error;
  }

  static async update(id: string, employee: Partial<Employee>): Promise<void> {
    const { error } = await supabase
      .from("employees")
      .update(employee)
      .eq("id", id);
    
    if (error) throw error;
  }

  static async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from("employees")
      .delete()
      .eq("id", id);
    
    if (error) throw error;
  }
}
