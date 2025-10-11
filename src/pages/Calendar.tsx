import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useCentro } from "@/contexts/CentroContext";
import Layout from "@/components/Layout";
import { RestaurantFilterGuard } from "@/components/RestaurantFilterGuard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Calendar as BigCalendar, momentLocalizer, View, Event as CalendarEvent } from "react-big-calendar";
import moment from "moment";
import "moment/locale/es";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { Plus, Clock, AlertCircle, Loader2, Calendar as CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as DatePickerCalendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

moment.locale("es");
const localizer = momentLocalizer(moment);

interface Employee {
  id: string;
  nombre: string;
  apellidos: string;
  centro: string | null;
}

interface Schedule {
  id: string;
  employee_id: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  horas_planificadas: number;
  tipo_asignacion: string | null;
  service_id: string | null;
}

interface Absence {
  id: string;
  employee_id: string;
  fecha: string;
  horas_ausencia: number;
  tipo: string;
  motivo: string | null;
}

interface CalendarEventData extends CalendarEvent {
  id: string;
  type: "schedule" | "absence";
  employeeId: string;
  employeeName: string;
  centro: string | null;
  details: Schedule | Absence;
  resource?: { color: string };
}

const CalendarPage = () => {
  const { isAdmin } = useUserRole();
  const { selectedCentro } = useCentro();
  const [view, setView] = useState<View>("month");
  const [date, setDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [services, setServices] = useState<string[]>([]);
  
  const [selectedService, setSelectedService] = useState<string>("all");
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [isAbsenceDialogOpen, setIsAbsenceDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEventData | null>(null);
  
  // Form states
  const [scheduleForm, setScheduleForm] = useState({
    employee_id: "",
    fecha: new Date(),
    hora_inicio: "",
    hora_fin: "",
    tipo_asignacion: "",
    service_id: "",
  });

  const [absenceForm, setAbsenceForm] = useState({
    employee_id: "",
    fecha: new Date(),
    horas_ausencia: "",
    tipo: "",
    motivo: "",
  });

  useEffect(() => {
    fetchData();
    setupRealtimeSubscription();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      const [employeesRes, schedulesRes, absencesRes] = await Promise.all([
        supabase.from("employees").select("*").order("apellidos"),
        supabase.from("schedules").select("*"),
        supabase.from("absences").select("*"),
      ]);

      if (employeesRes.error) throw employeesRes.error;
      if (schedulesRes.error) throw schedulesRes.error;
      if (absencesRes.error) throw absencesRes.error;

      setEmployees(employeesRes.data || []);
      setSchedules(schedulesRes.data || []);
      setAbsences(absencesRes.data || []);

      // Extract unique services
      const uniqueServices = Array.from(
        new Set(schedulesRes.data?.map(s => s.service_id).filter(Boolean))
      ) as string[];
      setServices(uniqueServices);
    } catch (error: any) {
      console.error("Error fetching data:", error);
      toast.error("Error al cargar datos");
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    const schedulesChannel = supabase
      .channel("schedules-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "schedules" },
        () => {
          fetchData();
        }
      )
      .subscribe();

    const absencesChannel = supabase
      .channel("absences-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "absences" },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(schedulesChannel);
      supabase.removeChannel(absencesChannel);
    };
  };

  const calendarEvents: CalendarEventData[] = useMemo(() => {
    const scheduleEvents: CalendarEventData[] = schedules
      .filter((s) => {
        const emp = employees.find((e) => e.id === s.employee_id);
        if (!emp) return false;

        const matchesCentro = !selectedCentro || emp.centro === selectedCentro;
        const matchesService = selectedService === "all" || s.service_id === selectedService;
        const matchesEmployee = selectedEmployee === "all" || s.employee_id === selectedEmployee;

        return matchesCentro && matchesService && matchesEmployee;
      })
      .map((s) => {
        const emp = employees.find((e) => e.id === s.employee_id);
        const startDate = new Date(`${s.fecha}T${s.hora_inicio}`);
        const endDate = new Date(`${s.fecha}T${s.hora_fin}`);

        return {
          id: s.id,
          type: "schedule" as const,
          employeeId: s.employee_id,
          employeeName: emp ? `${emp.nombre} ${emp.apellidos}` : "Empleado",
          centro: emp?.centro || null,
          title: `${emp?.nombre || ""} ${emp?.apellidos || ""} - ${s.tipo_asignacion || "Turno"}`,
          start: startDate,
          end: endDate,
          resource: { color: "hsl(var(--primary))" },
          details: s,
        };
      });

    const absenceEvents: CalendarEventData[] = absences
      .filter((a) => {
        const emp = employees.find((e) => e.id === a.employee_id);
        if (!emp) return false;

        const matchesCentro = !selectedCentro || emp.centro === selectedCentro;
        const matchesEmployee = selectedEmployee === "all" || a.employee_id === selectedEmployee;

        return matchesCentro && matchesEmployee;
      })
      .map((a) => {
        const emp = employees.find((e) => e.id === a.employee_id);
        const startDate = new Date(`${a.fecha}T09:00:00`);
        const endDate = new Date(startDate);
        endDate.setHours(startDate.getHours() + Number(a.horas_ausencia));

        return {
          id: a.id,
          type: "absence" as const,
          employeeId: a.employee_id,
          employeeName: emp ? `${emp.nombre} ${emp.apellidos}` : "Empleado",
          centro: emp?.centro || null,
          title: `${emp?.nombre || ""} ${emp?.apellidos || ""} - ${a.tipo}`,
          start: startDate,
          end: endDate,
          resource: { color: "hsl(var(--destructive))" },
          details: a,
        };
      });

    return [...scheduleEvents, ...absenceEvents];
  }, [schedules, absences, employees, selectedCentro, selectedService, selectedEmployee]);

  const handleSaveSchedule = async () => {
    if (!scheduleForm.employee_id || !scheduleForm.hora_inicio || !scheduleForm.hora_fin) {
      toast.error("Por favor completa todos los campos obligatorios");
      return;
    }

    try {
      const start = moment(`${format(scheduleForm.fecha, "yyyy-MM-dd")} ${scheduleForm.hora_inicio}`);
      const end = moment(`${format(scheduleForm.fecha, "yyyy-MM-dd")} ${scheduleForm.hora_fin}`);
      const hours = end.diff(start, "hours", true);

      const scheduleData = {
        employee_id: scheduleForm.employee_id,
        fecha: format(scheduleForm.fecha, "yyyy-MM-dd"),
        hora_inicio: scheduleForm.hora_inicio,
        hora_fin: scheduleForm.hora_fin,
        horas_planificadas: hours,
        tipo_asignacion: scheduleForm.tipo_asignacion || null,
        service_id: scheduleForm.service_id || null,
      };

      if (editingEvent && editingEvent.type === "schedule") {
        const { error } = await supabase
          .from("schedules")
          .update(scheduleData)
          .eq("id", editingEvent.id);

        if (error) throw error;
        toast.success("Turno actualizado correctamente");
      } else {
        const { error } = await supabase.from("schedules").insert(scheduleData);

        if (error) throw error;
        toast.success("Turno creado correctamente");
      }

      setIsScheduleDialogOpen(false);
      resetScheduleForm();
      setEditingEvent(null);
    } catch (error: any) {
      console.error("Error saving schedule:", error);
      toast.error("Error al guardar turno: " + error.message);
    }
  };

  const handleSaveAbsence = async () => {
    if (!absenceForm.employee_id || !absenceForm.horas_ausencia || !absenceForm.tipo) {
      toast.error("Por favor completa todos los campos obligatorios");
      return;
    }

    try {
      const absenceData = {
        employee_id: absenceForm.employee_id,
        fecha: format(absenceForm.fecha, "yyyy-MM-dd"),
        horas_ausencia: Number(absenceForm.horas_ausencia),
        tipo: absenceForm.tipo,
        motivo: absenceForm.motivo || null,
      };

      if (editingEvent && editingEvent.type === "absence") {
        const { error } = await supabase
          .from("absences")
          .update(absenceData)
          .eq("id", editingEvent.id);

        if (error) throw error;
        toast.success("Ausencia actualizada correctamente");
      } else {
        const { error } = await supabase.from("absences").insert(absenceData);

        if (error) throw error;
        toast.success("Ausencia registrada correctamente");
      }

      setIsAbsenceDialogOpen(false);
      resetAbsenceForm();
      setEditingEvent(null);
    } catch (error: any) {
      console.error("Error saving absence:", error);
      toast.error("Error al guardar ausencia: " + error.message);
    }
  };

  const handleDeleteEvent = async () => {
    if (!editingEvent) return;

    if (!window.confirm("¿Estás seguro de que deseas eliminar este evento?")) {
      return;
    }

    try {
      if (editingEvent.type === "schedule") {
        const { error } = await supabase.from("schedules").delete().eq("id", editingEvent.id);
        if (error) throw error;
        toast.success("Turno eliminado correctamente");
      } else {
        const { error } = await supabase.from("absences").delete().eq("id", editingEvent.id);
        if (error) throw error;
        toast.success("Ausencia eliminada correctamente");
      }

      setIsScheduleDialogOpen(false);
      setIsAbsenceDialogOpen(false);
      setEditingEvent(null);
      resetScheduleForm();
      resetAbsenceForm();
    } catch (error: any) {
      console.error("Error deleting event:", error);
      toast.error("Error al eliminar evento: " + error.message);
    }
  };

  const handleSelectEvent = (event: CalendarEventData) => {
    setEditingEvent(event);

    if (event.type === "schedule") {
      const schedule = event.details as Schedule;
      setScheduleForm({
        employee_id: schedule.employee_id,
        fecha: new Date(schedule.fecha),
        hora_inicio: schedule.hora_inicio,
        hora_fin: schedule.hora_fin,
        tipo_asignacion: schedule.tipo_asignacion || "",
        service_id: schedule.service_id || "",
      });
      setIsScheduleDialogOpen(true);
    } else {
      const absence = event.details as Absence;
      setAbsenceForm({
        employee_id: absence.employee_id,
        fecha: new Date(absence.fecha),
        horas_ausencia: String(absence.horas_ausencia),
        tipo: absence.tipo,
        motivo: absence.motivo || "",
      });
      setIsAbsenceDialogOpen(true);
    }
  };

  const resetScheduleForm = () => {
    setScheduleForm({
      employee_id: "",
      fecha: new Date(),
      hora_inicio: "",
      hora_fin: "",
      tipo_asignacion: "",
      service_id: "",
    });
  };

  const resetAbsenceForm = () => {
    setAbsenceForm({
      employee_id: "",
      fecha: new Date(),
      horas_ausencia: "",
      tipo: "",
      motivo: "",
    });
  };

  const eventStyleGetter = (event: CalendarEventData) => {
    return {
      style: {
        backgroundColor: event.resource?.color || "hsl(var(--primary))",
        borderRadius: "4px",
        opacity: 0.9,
        color: "white",
        border: "0px",
        display: "block",
      },
    };
  };

  return (
    <Layout>
      <RestaurantFilterGuard>
        <div className="p-6 space-y-6 animate-fade-in">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Calendario de Planificación</h1>
            <p className="text-muted-foreground mt-1">
              Gestiona turnos y ausencias del equipo
            </p>
          </div>

          <div className="flex gap-2">
            <Dialog open={isScheduleDialogOpen} onOpenChange={(open) => {
              setIsScheduleDialogOpen(open);
              if (!open) {
                setEditingEvent(null);
                resetScheduleForm();
              }
            }}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Clock className="h-4 w-4" />
                  Nuevo Turno
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingEvent ? "Editar Turno" : "Crear Nuevo Turno"}
                  </DialogTitle>
                  <DialogDescription>
                    Completa los datos del turno de trabajo
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Empleado *</Label>
                    <Select
                      value={scheduleForm.employee_id}
                      onValueChange={(value) =>
                        setScheduleForm({ ...scheduleForm, employee_id: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar empleado" />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.map((emp) => (
                          <SelectItem key={emp.id} value={emp.id}>
                            {emp.nombre} {emp.apellidos}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Fecha *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !scheduleForm.fecha && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {format(scheduleForm.fecha, "PPP", { locale: es })}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <DatePickerCalendar
                          mode="single"
                          selected={scheduleForm.fecha}
                          onSelect={(date) => date && setScheduleForm({ ...scheduleForm, fecha: date })}
                          locale={es}
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Hora Inicio *</Label>
                      <Input
                        type="time"
                        value={scheduleForm.hora_inicio}
                        onChange={(e) =>
                          setScheduleForm({ ...scheduleForm, hora_inicio: e.target.value })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Hora Fin *</Label>
                      <Input
                        type="time"
                        value={scheduleForm.hora_fin}
                        onChange={(e) =>
                          setScheduleForm({ ...scheduleForm, hora_fin: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Tipo de Asignación</Label>
                    <Input
                      placeholder="Ej: Turno mañana, Turno tarde..."
                      value={scheduleForm.tipo_asignacion}
                      onChange={(e) =>
                        setScheduleForm({ ...scheduleForm, tipo_asignacion: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>ID de Servicio</Label>
                    <Input
                      placeholder="ID del servicio"
                      value={scheduleForm.service_id}
                      onChange={(e) =>
                        setScheduleForm({ ...scheduleForm, service_id: e.target.value })
                      }
                    />
                  </div>
                </div>

                <DialogFooter className="gap-2">
                  {editingEvent && (
                    <Button variant="destructive" onClick={handleDeleteEvent}>
                      Eliminar
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => setIsScheduleDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSaveSchedule}>
                    {editingEvent ? "Actualizar" : "Crear"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={isAbsenceDialogOpen} onOpenChange={(open) => {
              setIsAbsenceDialogOpen(open);
              if (!open) {
                setEditingEvent(null);
                resetAbsenceForm();
              }
            }}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Registrar Ausencia
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>
                    {editingEvent ? "Editar Ausencia" : "Registrar Nueva Ausencia"}
                  </DialogTitle>
                  <DialogDescription>
                    Registra una ausencia o incidencia
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Empleado *</Label>
                    <Select
                      value={absenceForm.employee_id}
                      onValueChange={(value) =>
                        setAbsenceForm({ ...absenceForm, employee_id: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar empleado" />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.map((emp) => (
                          <SelectItem key={emp.id} value={emp.id}>
                            {emp.nombre} {emp.apellidos}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Fecha *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !absenceForm.fecha && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {format(absenceForm.fecha, "PPP", { locale: es })}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <DatePickerCalendar
                          mode="single"
                          selected={absenceForm.fecha}
                          onSelect={(date) => date && setAbsenceForm({ ...absenceForm, fecha: date })}
                          locale={es}
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label>Horas de Ausencia *</Label>
                    <Input
                      type="number"
                      step="0.5"
                      placeholder="Ej: 8"
                      value={absenceForm.horas_ausencia}
                      onChange={(e) =>
                        setAbsenceForm({ ...absenceForm, horas_ausencia: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Tipo de Ausencia *</Label>
                    <Select
                      value={absenceForm.tipo}
                      onValueChange={(value) =>
                        setAbsenceForm({ ...absenceForm, tipo: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Enfermedad">Enfermedad</SelectItem>
                        <SelectItem value="Vacaciones">Vacaciones</SelectItem>
                        <SelectItem value="Permiso">Permiso</SelectItem>
                        <SelectItem value="Baja Médica">Baja Médica</SelectItem>
                        <SelectItem value="Asuntos Propios">Asuntos Propios</SelectItem>
                        <SelectItem value="Otro">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Motivo</Label>
                    <Textarea
                      placeholder="Describe el motivo de la ausencia..."
                      value={absenceForm.motivo}
                      onChange={(e) =>
                        setAbsenceForm({ ...absenceForm, motivo: e.target.value })
                      }
                      rows={3}
                    />
                  </div>
                </div>

                <DialogFooter className="gap-2">
                  {editingEvent && (
                    <Button variant="destructive" onClick={handleDeleteEvent}>
                      Eliminar
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => setIsAbsenceDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSaveAbsence}>
                    {editingEvent ? "Actualizar" : "Registrar"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-3">

            <Select value={selectedService} onValueChange={setSelectedService}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filtrar por servicio" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los servicios</SelectItem>
                {services.map((service) => (
                  <SelectItem key={service} value={service}>
                    {service}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger className="w-full sm:w-[250px]">
                <SelectValue placeholder="Filtrar por empleado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los empleados</SelectItem>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.nombre} {emp.apellidos}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Calendar */}
        <Card>
          <CardContent className="p-6">
            {loading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="h-[700px]">
                <BigCalendar
                  localizer={localizer}
                  events={calendarEvents}
                  startAccessor="start"
                  endAccessor="end"
                  view={view}
                  onView={setView}
                  date={date}
                  onNavigate={setDate}
                  onSelectEvent={handleSelectEvent}
                  eventPropGetter={eventStyleGetter}
                  messages={{
                    next: "Siguiente",
                    previous: "Anterior",
                    today: "Hoy",
                    month: "Mes",
                    week: "Semana",
                    day: "Día",
                    agenda: "Agenda",
                    date: "Fecha",
                    time: "Hora",
                    event: "Evento",
                    noEventsInRange: "No hay eventos en este rango",
                    showMore: (total) => `+ Ver más (${total})`,
                  }}
                  views={["month", "week", "day", "agenda"]}
                  className="rounded-lg"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Legend */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4 items-center justify-center">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: "hsl(var(--primary))" }} />
                <span className="text-sm">Turnos Programados</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: "hsl(var(--destructive))" }} />
                <span className="text-sm">Ausencias</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      </RestaurantFilterGuard>
    </Layout>
  );
};

export default CalendarPage;
