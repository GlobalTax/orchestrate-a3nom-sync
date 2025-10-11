import { supabase } from "@/integrations/supabase/client";

export interface CostMetrics {
  coste_total: number;
  coste_medio_hora: number;
  total_horas: number;
}

export interface HoursMetrics {
  horas_planificadas: number;
  horas_trabajadas: number;
  horas_ausencia: number;
  tasa_absentismo: number;
}

export interface PayrollCost {
  employee_id: string;
  employee_name: string;
  employee_centro: string;
  horas_trabajadas: number;
  horas_vacaciones: number;
  horas_formacion: number;
  coste_total: number;
  coste_medio: number;
}

export interface PlannedVsActualCost {
  centro: string;
  costes_planificados: number;
  costes_reales: number;
}

export class CostsService {
  static async getCostMetrics(
    startDate: string,
    endDate: string,
    centro?: string
  ): Promise<CostMetrics> {
    const { data, error } = await supabase.rpc("get_cost_metrics", {
      p_start_date: startDate,
      p_end_date: endDate,
      p_centro: centro || null,
    });

    if (error) throw error;
    return data?.[0] || { coste_total: 0, coste_medio_hora: 0, total_horas: 0 };
  }

  static async getHoursMetrics(
    startDate: string,
    endDate: string,
    centro?: string
  ): Promise<HoursMetrics> {
    const { data, error } = await supabase.rpc("get_hours_metrics", {
      p_start_date: startDate,
      p_end_date: endDate,
      p_centro: centro || null,
    });

    if (error) throw error;
    return data?.[0] || {
      horas_planificadas: 0,
      horas_trabajadas: 0,
      horas_ausencia: 0,
      tasa_absentismo: 0,
    };
  }

  static async getPayrollCosts(
    startDate: string,
    endDate: string,
    centro?: string
  ): Promise<PayrollCost[]> {
    const { data, error } = await supabase.rpc("get_payroll_costs", {
      p_start_date: startDate,
      p_end_date: endDate,
      p_centro: centro || null,
    });

    if (error) throw error;
    return data || [];
  }

  static async getPlannedVsActualCosts(
    startDate: string,
    endDate: string,
    centro?: string
  ): Promise<PlannedVsActualCost[]> {
    const { data, error } = await supabase.rpc("get_planned_vs_actual_costs", {
      p_start_date: startDate,
      p_end_date: endDate,
      p_centro: centro || null,
    });

    if (error) throw error;
    return data || [];
  }

  static async getDailyHoursEvolution(
    startDate: string,
    endDate: string,
    centro?: string
  ): Promise<any[]> {
    const { data, error } = await supabase.rpc("get_daily_hours_evolution", {
      p_start_date: startDate,
      p_end_date: endDate,
      p_centro: centro || null,
    });

    if (error) throw error;
    return data || [];
  }
}
