import { useState } from "react";
import { useDashboardMetrics } from "@/hooks/useDashboardMetrics";
import { useEmployeeCentros } from "@/hooks/useEmployeeCentros";
import { CostCalculations } from "@/lib/calculations/costCalculations";
import { Formatters } from "@/lib/formatters";
import { PageHeader, LoadingSpinner, EmptyState } from "@/components/common";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Users, Clock, TrendingUp, DollarSign, CalendarIcon, AlertTriangle } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Badge } from "@/components/ui/badge";

const Dashboard = () => {
  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(endOfMonth(new Date()));
  const [selectedCentro, setSelectedCentro] = useState<string>("all");

  const { centros } = useEmployeeCentros();
  const { hoursMetrics, costMetrics, dailyData, serviceMetrics, isLoading } = useDashboardMetrics(
    startDate,
    endDate,
    selectedCentro
  );

  const absenteeismRate = hoursMetrics?.tasa_absentismo || 0;

  const statCards = [
    {
      title: "Horas Planificadas",
      value: Formatters.formatNumber(hoursMetrics?.horas_planificadas || 0),
      icon: Clock,
      description: "Total de horas programadas",
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Horas Trabajadas",
      value: Formatters.formatNumber(hoursMetrics?.horas_trabajadas || 0),
      icon: Users,
      description: "Horas efectivamente trabajadas",
      color: "text-success",
      bgColor: "bg-success/10",
    },
    {
      title: "Tasa de Absentismo",
      value: CostCalculations.formatPercentage(absenteeismRate),
      icon: TrendingUp,
      description: `${Formatters.formatNumber(hoursMetrics?.horas_ausencia || 0)}h de ausencias`,
      color: absenteeismRate > 10 ? "text-destructive" : "text-warning",
      bgColor: absenteeismRate > 10 ? "bg-destructive/10" : "bg-warning/10",
    },
    {
      title: "Coste Total",
      value: CostCalculations.formatCurrency(costMetrics?.coste_total || 0),
      icon: DollarSign,
      description: `${CostCalculations.formatCurrency(costMetrics?.coste_medio_hora || 0)}/hora`,
      color: "text-chart-1",
      bgColor: "bg-chart-1/10",
    },
  ];

  return (
    <div className="p-6 space-y-6 animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <PageHeader
            title="Dashboard de Métricas"
            description="Visión general de planificación y costes"
          />

          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={selectedCentro} onValueChange={setSelectedCentro}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Seleccionar centro" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los centros</SelectItem>
                {centros.map((centro) => (
                  <SelectItem key={centro} value={centro}>
                    {centro}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[240px] justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(startDate, "dd/MM/yyyy", { locale: es })} - {format(endDate, "dd/MM/yyyy", { locale: es })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <div className="p-3 space-y-3">
                  <div>
                    <p className="text-sm font-medium mb-2">Fecha inicio</p>
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={(date) => date && setStartDate(date)}
                      locale={es}
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2">Fecha fin</p>
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={(date) => date && setEndDate(date)}
                      locale={es}
                    />
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {isLoading ? (
          <LoadingSpinner size="lg" />
        ) : (
          <>
            {absenteeismRate > 10 && (
              <Alert variant="destructive" className="animate-scale-in">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>¡Alerta de Absentismo Elevado!</AlertTitle>
                <AlertDescription>
                  La tasa de absentismo actual es del {CostCalculations.formatPercentage(absenteeismRate)}, 
                  lo que supera el umbral del 10%. Se recomienda revisar las causas 
                  y tomar medidas correctivas.
                </AlertDescription>
              </Alert>
            )}

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {statCards.map((stat) => (
                <Card key={stat.title} className="hover:shadow-lg transition-all hover-scale">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {stat.title}
                    </CardTitle>
                    <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                      <stat.icon className={`h-4 w-4 ${stat.color}`} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stat.value}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {stat.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

              <Card className="animate-fade-in">
                <CardHeader>
                  <CardTitle>Evolución Diaria de Horas</CardTitle>
                  <CardDescription>
                    Comparativa de horas planificadas vs. trabajadas y ausencias
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {dailyData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={350}>
                      <LineChart data={dailyData}>
...
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyState message="No hay datos disponibles para el periodo seleccionado" />
                  )}
                </CardContent>
              </Card>

            <div className="grid gap-6 md:grid-cols-2">
              <Card className="animate-fade-in">
                <CardHeader>
                  <CardTitle>Distribución de Horas</CardTitle>
                  <CardDescription>
                    Comparativa por tipo de hora
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {hoursMetrics && (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={[
                        { name: 'Planificadas', valor: Number(hoursMetrics.horas_planificadas) },
                        { name: 'Trabajadas', valor: Number(hoursMetrics.horas_trabajadas) },
                        { name: 'Ausencias', valor: Number(hoursMetrics.horas_ausencia) },
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis 
                          dataKey="name" 
                          className="text-xs"
                          tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        />
                        <YAxis 
                          className="text-xs"
                          tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                        <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card className="animate-fade-in">
                <CardHeader>
                  <CardTitle>Resumen de Costes</CardTitle>
                  <CardDescription>
                    Análisis financiero del periodo
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center p-4 bg-muted/50 rounded-lg">
                    <span className="font-medium">Coste Total:</span>
                    <span className="text-xl font-bold text-primary">
                      {CostCalculations.formatCurrency(costMetrics?.coste_total || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-muted/50 rounded-lg">
                    <span className="font-medium">Coste por Hora:</span>
                    <span className="text-xl font-bold text-chart-1">
                      {CostCalculations.formatCurrency(costMetrics?.coste_medio_hora || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-muted/50 rounded-lg">
                    <span className="font-medium">Horas Totales:</span>
                    <span className="text-xl font-bold text-chart-2">
                      {Formatters.formatNumber(costMetrics?.total_horas || 0)}h
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {serviceMetrics.length > 0 && (
              <Card className="animate-fade-in">
                <CardHeader>
                  <CardTitle>Top Services por Horas Planificadas</CardTitle>
                  <CardDescription>
                    Distribución de horas por service de Orquest
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {serviceMetrics.slice(0, 5).map((service) => (
                    <div
                      key={service.service_id}
                      className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="font-medium">{service.service_descripcion}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {service.empleados_activos} empleado{service.empleados_activos !== 1 ? "s" : ""} activo{service.empleados_activos !== 1 ? "s" : ""}
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className="font-mono">
                          {Number(service.horas_planificadas).toLocaleString("es-ES")}h
                        </Badge>
                        <div className="text-xs text-muted-foreground mt-1">
                          {Number(service.horas_trabajadas).toLocaleString("es-ES")}h trabajadas
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </>
        )}
    </div>
  );
};

export default Dashboard;