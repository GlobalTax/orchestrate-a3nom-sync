export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      absences: {
        Row: {
          created_at: string | null
          employee_id: string
          fecha: string
          horas_ausencia: number
          id: string
          motivo: string | null
          tipo: string
        }
        Insert: {
          created_at?: string | null
          employee_id: string
          fecha: string
          horas_ausencia: number
          id?: string
          motivo?: string | null
          tipo: string
        }
        Update: {
          created_at?: string | null
          employee_id?: string
          fecha?: string
          horas_ausencia?: number
          id?: string
          motivo?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "absences_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      dq_issues: {
        Row: {
          centro: string | null
          created_at: string
          detalle: Json | null
          employee_id: string | null
          id: string
          periodo_fin: string
          periodo_inicio: string
          resuelto: boolean
          resuelto_at: string | null
          resuelto_por: string | null
          severidad: Database["public"]["Enums"]["dq_severity"]
          tipo: string
          updated_at: string
        }
        Insert: {
          centro?: string | null
          created_at?: string
          detalle?: Json | null
          employee_id?: string | null
          id?: string
          periodo_fin: string
          periodo_inicio: string
          resuelto?: boolean
          resuelto_at?: string | null
          resuelto_por?: string | null
          severidad?: Database["public"]["Enums"]["dq_severity"]
          tipo: string
          updated_at?: string
        }
        Update: {
          centro?: string | null
          created_at?: string
          detalle?: Json | null
          employee_id?: string | null
          id?: string
          periodo_fin?: string
          periodo_inicio?: string
          resuelto?: boolean
          resuelto_at?: string | null
          resuelto_por?: string | null
          severidad?: Database["public"]["Enums"]["dq_severity"]
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dq_issues_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dq_issues_resuelto_por_fkey"
            columns: ["resuelto_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          apellidos: string
          centro: string | null
          codtrabajador_a3nom: string | null
          created_at: string | null
          email: string | null
          employee_id_orquest: string | null
          fecha_alta: string | null
          fecha_baja: string | null
          id: string
          nombre: string
          updated_at: string | null
        }
        Insert: {
          apellidos: string
          centro?: string | null
          codtrabajador_a3nom?: string | null
          created_at?: string | null
          email?: string | null
          employee_id_orquest?: string | null
          fecha_alta?: string | null
          fecha_baja?: string | null
          id?: string
          nombre: string
          updated_at?: string | null
        }
        Update: {
          apellidos?: string
          centro?: string | null
          codtrabajador_a3nom?: string | null
          created_at?: string | null
          email?: string | null
          employee_id_orquest?: string | null
          fecha_alta?: string | null
          fecha_baja?: string | null
          id?: string
          nombre?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      import_logs: {
        Row: {
          created_at: string | null
          error_details: Json | null
          error_rows: number
          file_name: string
          file_type: string
          id: string
          loaded_rows: number
          skipped_rows: number
          status: string
          total_rows: number
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          error_details?: Json | null
          error_rows?: number
          file_name: string
          file_type: string
          id?: string
          loaded_rows?: number
          skipped_rows?: number
          status?: string
          total_rows?: number
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          error_details?: Json | null
          error_rows?: number
          file_name?: string
          file_type?: string
          id?: string
          loaded_rows?: number
          skipped_rows?: number
          status?: string
          total_rows?: number
          user_id?: string | null
        }
        Relationships: []
      }
      import_mapping_profiles: {
        Row: {
          column_mappings: Json
          created_at: string | null
          file_type: string
          id: string
          profile_name: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          column_mappings: Json
          created_at?: string | null
          file_type: string
          id?: string
          profile_name: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          column_mappings?: Json
          created_at?: string | null
          file_type?: string
          id?: string
          profile_name?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      orquest_services: {
        Row: {
          datos_completos: Json | null
          id: string
          latitud: number | null
          longitud: number | null
          nombre: string
          updated_at: string | null
          zona_horaria: string | null
        }
        Insert: {
          datos_completos?: Json | null
          id: string
          latitud?: number | null
          longitud?: number | null
          nombre: string
          updated_at?: string | null
          zona_horaria?: string | null
        }
        Update: {
          datos_completos?: Json | null
          id?: string
          latitud?: number | null
          longitud?: number | null
          nombre?: string
          updated_at?: string | null
          zona_horaria?: string | null
        }
        Relationships: []
      }
      payrolls: {
        Row: {
          coste_total: number | null
          created_at: string | null
          desglose_costes: Json | null
          employee_id: string
          horas_formacion: number | null
          horas_trabajadas: number | null
          horas_vacaciones: number | null
          id: string
          periodo_fin: string
          periodo_inicio: string
        }
        Insert: {
          coste_total?: number | null
          created_at?: string | null
          desglose_costes?: Json | null
          employee_id: string
          horas_formacion?: number | null
          horas_trabajadas?: number | null
          horas_vacaciones?: number | null
          id?: string
          periodo_fin: string
          periodo_inicio: string
        }
        Update: {
          coste_total?: number | null
          created_at?: string | null
          desglose_costes?: Json | null
          employee_id?: string
          horas_formacion?: number | null
          horas_trabajadas?: number | null
          horas_vacaciones?: number | null
          id?: string
          periodo_fin?: string
          periodo_inicio?: string
        }
        Relationships: [
          {
            foreignKeyName: "payrolls_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          apellidos: string | null
          created_at: string | null
          email: string | null
          id: string
          nombre: string | null
          updated_at: string | null
        }
        Insert: {
          apellidos?: string | null
          created_at?: string | null
          email?: string | null
          id: string
          nombre?: string | null
          updated_at?: string | null
        }
        Update: {
          apellidos?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          nombre?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      schedules: {
        Row: {
          created_at: string | null
          employee_id: string
          fecha: string
          hora_fin: string
          hora_inicio: string
          horas_planificadas: number
          id: string
          service_id: string | null
          tipo_asignacion: string | null
        }
        Insert: {
          created_at?: string | null
          employee_id: string
          fecha: string
          hora_fin: string
          hora_inicio: string
          horas_planificadas: number
          id?: string
          service_id?: string | null
          tipo_asignacion?: string | null
        }
        Update: {
          created_at?: string | null
          employee_id?: string
          fecha?: string
          hora_fin?: string
          hora_inicio?: string
          horas_planificadas?: number
          id?: string
          service_id?: string | null
          tipo_asignacion?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedules_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          centro: string | null
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          centro?: string | null
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          centro?: string | null
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      detect_dq_issues: {
        Args: { p_centro?: string; p_end_date: string; p_start_date: string }
        Returns: {
          coste_atipico: number
          empleado_sin_centro: number
          issues_detected: number
          plan_sin_real: number
          real_sin_plan: number
        }[]
      }
      get_centros: {
        Args: Record<PropertyKey, never>
        Returns: {
          centro: string
        }[]
      }
      get_cost_metrics: {
        Args: { p_centro?: string; p_end_date: string; p_start_date: string }
        Returns: {
          coste_medio_hora: number
          coste_total: number
          total_horas: number
        }[]
      }
      get_daily_hours_evolution: {
        Args: { p_centro?: string; p_end_date: string; p_start_date: string }
        Returns: {
          fecha: string
          horas_ausencia: number
          horas_planificadas: number
          horas_trabajadas: number
        }[]
      }
      get_hours_metrics: {
        Args: { p_centro?: string; p_end_date: string; p_start_date: string }
        Returns: {
          horas_ausencia: number
          horas_planificadas: number
          horas_trabajadas: number
          tasa_absentismo: number
        }[]
      }
      get_payroll_costs: {
        Args: { p_centro?: string; p_end_date: string; p_start_date: string }
        Returns: {
          coste_medio: number
          coste_total: number
          employee_centro: string
          employee_id: string
          employee_name: string
          horas_formacion: number
          horas_trabajadas: number
          horas_vacaciones: number
        }[]
      }
      get_planned_vs_actual_costs: {
        Args: { p_centro?: string; p_end_date: string; p_start_date: string }
        Returns: {
          centro: string
          costes_planificados: number
          costes_reales: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "gestor"
      dq_severity: "critica" | "alta" | "media" | "baja"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "gestor"],
      dq_severity: ["critica", "alta", "media", "baja"],
    },
  },
} as const
