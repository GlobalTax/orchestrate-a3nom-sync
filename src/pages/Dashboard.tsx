import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Users, Clock, TrendingUp, DollarSign, CalendarIcon, AlertTriangle, Loader2 } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { toast } from "sonner";

interface HoursMetrics {
  horas_planificadas: number;
  horas_trabajadas: number;
  horas_ausencia: number;
  tasa_absentismo: number;
}

interface CostMetrics {
  coste_total: number;
  coste_medio_hora: number;
  total_horas: number;
}

interface DailyData {
  fecha: string;
  horas_planificadas: number;
  horas_trabajadas: number;
  horas_ausencia: number;
}

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(endOfMonth(new Date()));
  const [selectedCentro, setSelectedCentro] = useState<string>("all");
  const [centros, setCentros] = useState<string[]>([]);
  
  const [hoursMetrics, setHoursMetrics] = useState<HoursMetrics | null>(null);
  const [costMetrics, setCostMetrics] = useState<CostMetrics | null>(null);
  const [dailyData, setDailyData] = useState<DailyData[]>([]);

  useEffect(() => {
    fetchCentros();
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [startDate, endDate, selectedCentro]);

  const fetchCentros = async () => {
    try {
      const { data, error } = await supabase.rpc("get_centros");
      if (error) throw error;
      setCentros(data?.map((c: { centro: string }) => c.centro) || []);
    } catch (error: any) {
      console.error("Error fetching centros:", error);
      toast.error("Error al cargar centros");
    }
  };

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      
      const centro = selectedCentro === "all" ? null : selectedCentro;
      const startDateStr = format(startDate, "yyyy-MM-dd");
      const endDateStr = format(endDate, "yyyy-MM-dd");

      // Fetch hours metrics
      const { data: hoursData, error: hoursError } = await supabase.rpc("get_hours_metrics", {
        p_start_date: startDateStr,
        p_end_date: endDateStr,
        p_centro: centro,
      });

      if (hoursError) throw hoursError;
      setHoursMetrics(hoursData?.[0] || null);

      // Fetch cost metrics
      const { data: costData, error: costError } = await supabase.rpc("get_cost_metrics", {
        p_start_date: startDateStr,
        p_end_date: endDateStr,
        p_centro: centro,
      });

      if (costError) throw costError;
      setCostMetrics(costData?.[0] || null);

      // Fetch daily evolution
      const { data: dailyEvolution, error: dailyError } = await supabase.rpc("get_daily_hours_evolution", {
        p_start_date: startDateStr,
        p_end_date: endDateStr,
        p_centro: centro,
      });

      if (dailyError) throw dailyError;
      setDailyData(
        dailyEvolution?.map((d: any) => ({
          fecha: format(new Date(d.fecha), "dd/MM", { locale: es }),
          horas_planificadas: Number(d.horas_planificadas) || 0,
          horas_trabajadas: Number(d.horas_trabajadas) || 0,
          horas_ausencia: Number(d.horas_ausencia) || 0,
        })) || []
      );

      // Check for high absenteeism and notify
      if (hoursData?.[0]?.tasa_absentismo > 10) {
        toast.warning(`¡Atención! Tasa de absentismo elevada: ${hoursData[0].tasa_absentismo}%`);
      }
    } catch (error: any) {
      console.error("Error fetching metrics:", error);
      toast.error("Error al cargar métricas: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: "Horas Planificadas",
      value: hoursMetrics?.horas_planificadas?.toLocaleString("es-ES") || "0",
      icon: Clock,
      description: "Total de horas programadas",
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Horas Trabajadas",
      value: hoursMetrics?.horas_trabajadas?.toLocaleString("es-ES") || "0",
      icon: Users,
      description: "Horas efectivamente trabajadas",
      color: "text-success",
      bgColor: "bg-success/10",
    },
    {
      title: "Tasa de Absentismo",
      value: `${hoursMetrics?.tasa_absentismo || 0}%`,
      icon: TrendingUp,
      description: `${hoursMetrics?.horas_ausencia || 0}h de ausencias`,
      color: (hoursMetrics?.tasa_absentismo || 0) > 10 ? "text-destructive" : "text-warning",
      bgColor: (hoursMetrics?.tasa_absentismo || 0) > 10 ? "bg-destructive/10" : "bg-warning/10",
    },
    {
      title: "Coste Total",
      value: `€${(costMetrics?.coste_total || 0).toLocaleString("es-ES", { maximumFractionDigits: 2 })}`,
      icon: DollarSign,
      description: `€${(costMetrics?.coste_medio_hora || 0).toFixed(2)}/hora`,
      color: "text-chart-1",
      bgColor: "bg-chart-1/10",
    },
  ];

  return (
    <Layout>
      <div className="p-6 space-y-6 animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Dashboard de Métricas</h1>
            <p className="text-muted-foreground mt-1">
              Visión general de planificación y costes
            </p>
          </div>

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

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {hoursMetrics && (hoursMetrics.tasa_absentismo || 0) > 10 && (
              <Alert variant="destructive" className="animate-scale-in">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>¡Alerta de Absentismo Elevado!</AlertTitle>
                <AlertDescription>
                  La tasa de absentismo actual es del {hoursMetrics.tasa_absentismo}%, 
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
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="fecha" 
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
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="horas_planificadas" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={2}
                        name="Planificadas"
                        dot={{ fill: 'hsl(var(--primary))' }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="horas_trabajadas" 
                        stroke="hsl(var(--chart-2))" 
                        strokeWidth={2}
                        name="Trabajadas"
                        dot={{ fill: 'hsl(var(--chart-2))' }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="horas_ausencia" 
                        stroke="hsl(var(--destructive))" 
                        strokeWidth={2}
                        name="Ausencias"
                        dot={{ fill: 'hsl(var(--destructive))' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                    No hay datos disponibles para el periodo seleccionado
                  </div>
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
                      €{(costMetrics?.coste_total || 0).toLocaleString("es-ES", { maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-muted/50 rounded-lg">
                    <span className="font-medium">Coste por Hora:</span>
                    <span className="text-xl font-bold text-chart-1">
                      €{(costMetrics?.coste_medio_hora || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-muted/50 rounded-lg">
                    <span className="font-medium">Horas Totales:</span>
                    <span className="text-xl font-bold text-chart-2">
                      {(costMetrics?.total_horas || 0).toLocaleString("es-ES")}h
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

export default Dashboard;