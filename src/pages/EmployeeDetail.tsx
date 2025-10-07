import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, 
  Mail, 
  Building2, 
  Calendar as CalendarIcon, 
  Clock,
  DollarSign,
  Loader2,
  Edit,
  Trash2
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Employee {
  id: string;
  nombre: string;
  apellidos: string;
  email: string | null;
  centro: string | null;
  fecha_alta: string | null;
  fecha_baja: string | null;
  employee_id_orquest: string | null;
  codtrabajador_a3nom: string | null;
}

interface Schedule {
  id: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  horas_planificadas: number;
  tipo_asignacion: string | null;
}

interface Absence {
  id: string;
  fecha: string;
  horas_ausencia: number;
  tipo: string;
  motivo: string | null;
}

interface Payroll {
  id: string;
  periodo_inicio: string;
  periodo_fin: string;
  horas_trabajadas: number | null;
  horas_vacaciones: number | null;
  horas_formacion: number | null;
  coste_total: number | null;
}

const EmployeeDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();
  
  const [loading, setLoading] = useState(true);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  useEffect(() => {
    if (id) {
      fetchEmployeeData();
    }
  }, [id]);

  const fetchEmployeeData = async () => {
    if (!id) return;

    try {
      setLoading(true);

      // Fetch employee
      const { data: empData, error: empError } = await supabase
        .from("employees")
        .select("*")
        .eq("id", id)
        .single();

      if (empError) throw empError;
      setEmployee(empData);

      // Fetch schedules
      const { data: schedData, error: schedError } = await supabase
        .from("schedules")
        .select("*")
        .eq("employee_id", id)
        .order("fecha", { ascending: false })
        .limit(30);

      if (schedError) throw schedError;
      setSchedules(schedData || []);

      // Fetch absences
      const { data: absData, error: absError } = await supabase
        .from("absences")
        .select("*")
        .eq("employee_id", id)
        .order("fecha", { ascending: false })
        .limit(30);

      if (absError) throw absError;
      setAbsences(absData || []);

      // Fetch recent payrolls
      const { data: payData, error: payError } = await supabase
        .from("payrolls")
        .select("*")
        .eq("employee_id", id)
        .order("periodo_fin", { ascending: false })
        .limit(6);

      if (payError) throw payError;
      setPayrolls(payData || []);
    } catch (error: any) {
      console.error("Error fetching employee data:", error);
      toast.error("Error al cargar datos del empleado");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!employee || !window.confirm(`¿Estás seguro de que deseas eliminar a ${employee.nombre} ${employee.apellidos}?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from("employees")
        .delete()
        .eq("id", employee.id);

      if (error) throw error;

      toast.success("Empleado eliminado correctamente");
      navigate("/employees");
    } catch (error: any) {
      console.error("Error deleting employee:", error);
      toast.error("Error al eliminar empleado: " + error.message);
    }
  };

  // Get dates with schedules or absences for calendar highlighting
  const markedDates = [
    ...schedules.map(s => new Date(s.fecha)),
    ...absences.map(a => new Date(a.fecha))
  ];

  const getEventsForDate = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const daySchedules = schedules.filter(s => s.fecha === dateStr);
    const dayAbsences = absences.filter(a => a.fecha === dateStr);
    return { schedules: daySchedules, absences: dayAbsences };
  };

  const selectedDateEvents = selectedDate ? getEventsForDate(selectedDate) : { schedules: [], absences: [] };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!employee) {
    return (
      <Layout>
        <div className="p-6">
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">Empleado no encontrado</p>
              <div className="flex justify-center mt-4">
                <Button onClick={() => navigate("/employees")}>
                  Volver al listado
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/employees")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">
                {employee.nombre} {employee.apellidos}
              </h1>
              <p className="text-muted-foreground mt-1">
                Información detallada del empleado
              </p>
            </div>
          </div>

          {isAdmin && (
            <div className="flex gap-2">
              <Button variant="outline" className="gap-2">
                <Edit className="h-4 w-4" />
                Editar
              </Button>
              <Button variant="destructive" className="gap-2" onClick={handleDelete}>
                <Trash2 className="h-4 w-4" />
                Eliminar
              </Button>
            </div>
          )}
        </div>

        {/* Personal Information */}
        <Card>
          <CardHeader>
            <CardTitle>Información Personal</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{employee.email || "No especificado"}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Centro</p>
                {employee.centro ? (
                  <Badge variant="outline">{employee.centro}</Badge>
                ) : (
                  <p className="font-medium">No especificado</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <CalendarIcon className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Fecha de Alta</p>
                <p className="font-medium">
                  {employee.fecha_alta
                    ? format(new Date(employee.fecha_alta), "dd/MM/yyyy", { locale: es })
                    : "No especificada"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <CalendarIcon className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Estado</p>
                <Badge
                  variant={employee.fecha_baja ? "destructive" : "default"}
                  className={
                    employee.fecha_baja ? "" : "bg-success hover:bg-success/80"
                  }
                >
                  {employee.fecha_baja
                    ? `Baja: ${format(new Date(employee.fecha_baja), "dd/MM/yyyy", { locale: es })}`
                    : "Activo"}
                </Badge>
              </div>
            </div>

            {employee.employee_id_orquest && (
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">ID Orquest</p>
                  <p className="font-medium font-mono text-sm">{employee.employee_id_orquest}</p>
                </div>
              </div>
            )}

            {employee.codtrabajador_a3nom && (
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">Código A3Nom</p>
                  <p className="font-medium font-mono text-sm">{employee.codtrabajador_a3nom}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Calendar and Schedule */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Calendario</CardTitle>
              <CardDescription>
                Planificaciones y ausencias del empleado
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <CalendarComponent
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                locale={es}
                className="rounded-md border"
                modifiers={{
                  scheduled: markedDates,
                }}
                modifiersStyles={{
                  scheduled: {
                    backgroundColor: "hsl(var(--primary) / 0.2)",
                    fontWeight: "bold",
                  },
                }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                Eventos del {selectedDate ? format(selectedDate, "dd/MM/yyyy", { locale: es }) : ""}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedDateEvents.schedules.length === 0 && selectedDateEvents.absences.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No hay eventos para esta fecha
                </p>
              ) : (
                <>
                  {selectedDateEvents.schedules.map((schedule) => (
                    <div key={schedule.id} className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg">
                      <Clock className="h-4 w-4 text-primary mt-1" />
                      <div className="flex-1">
                        <p className="font-medium">Turno Programado</p>
                        <p className="text-sm text-muted-foreground">
                          {schedule.hora_inicio} - {schedule.hora_fin} ({schedule.horas_planificadas}h)
                        </p>
                        {schedule.tipo_asignacion && (
                          <Badge variant="outline" className="mt-1">
                            {schedule.tipo_asignacion}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}

                  {selectedDateEvents.absences.map((absence) => (
                    <div key={absence.id} className="flex items-start gap-3 p-3 bg-destructive/5 rounded-lg">
                      <CalendarIcon className="h-4 w-4 text-destructive mt-1" />
                      <div className="flex-1">
                        <p className="font-medium">Ausencia</p>
                        <p className="text-sm text-muted-foreground">
                          {absence.horas_ausencia}h - {absence.tipo}
                        </p>
                        {absence.motivo && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {absence.motivo}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Payrolls */}
        <Card>
          <CardHeader>
            <CardTitle>Nóminas Recientes</CardTitle>
            <CardDescription>
              Resumen de las últimas 6 nóminas del empleado
            </CardDescription>
          </CardHeader>
          <CardContent>
            {payrolls.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                No hay nóminas registradas
              </p>
            ) : (
              <div className="space-y-4">
                {payrolls.map((payroll) => (
                  <div key={payroll.id} className="p-4 bg-muted/30 rounded-lg">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-medium">
                          {format(new Date(payroll.periodo_inicio), "dd/MM/yyyy", { locale: es })} - {format(new Date(payroll.periodo_fin), "dd/MM/yyyy", { locale: es })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-primary" />
                        <span className="text-xl font-bold">
                          €{(payroll.coste_total || 0).toLocaleString("es-ES", { maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                    <Separator className="my-2" />
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Horas Trabajadas</p>
                        <p className="font-medium">{payroll.horas_trabajadas || 0}h</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Vacaciones</p>
                        <p className="font-medium">{payroll.horas_vacaciones || 0}h</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Formación</p>
                        <p className="font-medium">{payroll.horas_formacion || 0}h</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default EmployeeDetail;
