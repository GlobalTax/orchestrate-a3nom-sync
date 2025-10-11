import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useCentro } from "@/contexts/CentroContext";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Download, DollarSign, Calendar as CalendarIcon, Loader2, TrendingUp, TrendingDown, Upload } from "lucide-react";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

interface PayrollData {
  employee_id: string;
  employee_name: string;
  employee_centro: string;
  horas_trabajadas: number;
  horas_vacaciones: number;
  horas_formacion: number;
  coste_total: number;
  coste_medio: number;
}

interface ComparisonData {
  centro: string;
  costes_planificados: number;
  costes_reales: number;
}

const Costs = () => {
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();
  const { selectedCentro } = useCentro();
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(endOfMonth(new Date()));
  
  const [payrollData, setPayrollData] = useState<PayrollData[]>([]);
  const [comparisonData, setComparisonData] = useState<ComparisonData[]>([]);

  useEffect(() => {
    fetchCostData();
  }, [startDate, endDate, selectedCentro]);

  const fetchCostData = async () => {
    try {
      setLoading(true);
      const startDateStr = format(startDate, "yyyy-MM-dd");
      const endDateStr = format(endDate, "yyyy-MM-dd");

      // Fetch payroll costs
      const { data: payrollCosts, error: payrollError } = await supabase.rpc("get_payroll_costs", {
        p_start_date: startDateStr,
        p_end_date: endDateStr,
        p_centro: selectedCentro,
      });

      if (payrollError) throw payrollError;
      setPayrollData(payrollCosts || []);

      // Fetch planned vs actual comparison
      const { data: comparison, error: comparisonError } = await supabase.rpc("get_planned_vs_actual_costs", {
        p_start_date: startDateStr,
        p_end_date: endDateStr,
        p_centro: selectedCentro,
      });

      if (comparisonError) throw comparisonError;
      setComparisonData(comparison || []);
    } catch (error: any) {
      console.error("Error fetching cost data:", error);
      toast.error("Error al cargar datos de costes: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (payrollData.length === 0) {
      toast.error("No hay datos para exportar");
      return;
    }

    const headers = [
      "Empleado",
      "Centro",
      "Horas Trabajadas",
      "Horas Vacaciones",
      "Horas Formación",
      "Coste Total",
      "Coste Medio/Hora"
    ];

    const rows = payrollData.map((item) => [
      item.employee_name,
      item.employee_centro || "",
      Number(item.horas_trabajadas).toFixed(2),
      Number(item.horas_vacaciones).toFixed(2),
      Number(item.horas_formacion).toFixed(2),
      Number(item.coste_total).toFixed(2),
      Number(item.coste_medio).toFixed(2),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `costes_${format(startDate, "yyyy-MM-dd")}_${format(endDate, "yyyy-MM-dd")}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("Datos exportados correctamente");
  };

  // Calculate summary statistics
  const totalHorasTrabajadas = payrollData.reduce((sum, item) => sum + Number(item.horas_trabajadas), 0);
  const totalCoste = payrollData.reduce((sum, item) => sum + Number(item.coste_total), 0);
  const totalHorasVacaciones = payrollData.reduce((sum, item) => sum + Number(item.horas_vacaciones), 0);
  const totalHorasFormacion = payrollData.reduce((sum, item) => sum + Number(item.horas_formacion), 0);
  const costeMedio = totalHorasTrabajadas > 0 ? totalCoste / totalHorasTrabajadas : 0;

  // Calculate comparison totals
  const totalPlanned = comparisonData.reduce((sum, item) => sum + Number(item.costes_planificados), 0);
  const totalActual = comparisonData.reduce((sum, item) => sum + Number(item.costes_reales), 0);
  const variance = totalActual - totalPlanned;
  const variancePercentage = totalPlanned > 0 ? ((variance / totalPlanned) * 100) : 0;

  return (
    <Layout>
      <div className="p-6 space-y-6 animate-fade-in">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Análisis de Costes</h1>
            <p className="text-muted-foreground mt-1">
              Seguimiento detallado de costes de personal
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            {isAdmin && (
              <Button 
                variant="outline" 
                onClick={() => navigate("/admin/importar-nominas")}
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                Importar Nóminas
              </Button>
            )}

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full sm:w-[280px] justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(startDate, "dd/MM/yyyy", { locale: es })} - {format(endDate, "dd/MM/yyyy", { locale: es })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <div className="p-3 space-y-3">
                  <div>
                    <p className="text-sm font-medium mb-2">Fecha inicio</p>
                    <CalendarComponent
                      mode="single"
                      selected={startDate}
                      onSelect={(date) => date && setStartDate(date)}
                      locale={es}
                      className="pointer-events-auto"
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2">Fecha fin</p>
                    <CalendarComponent
                      mode="single"
                      selected={endDate}
                      onSelect={(date) => date && setEndDate(date)}
                      locale={es}
                      className="pointer-events-auto"
                    />
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <Button onClick={exportToCSV} className="gap-2">
              <Download className="h-4 w-4" />
              Exportar CSV
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <Card className="hover:shadow-lg transition-all hover-scale">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Coste Total
                  </CardTitle>
                  <DollarSign className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    €{totalCoste.toLocaleString("es-ES", { maximumFractionDigits: 2 })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Coste total del periodo
                  </p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-all hover-scale">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Horas Trabajadas
                  </CardTitle>
                  <DollarSign className="h-4 w-4 text-chart-2" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {totalHorasTrabajadas.toLocaleString("es-ES", { maximumFractionDigits: 2 })}h
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Total horas trabajadas
                  </p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-all hover-scale">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Coste Medio/Hora
                  </CardTitle>
                  <DollarSign className="h-4 w-4 text-chart-3" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    €{costeMedio.toLocaleString("es-ES", { maximumFractionDigits: 2 })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Promedio por hora
                  </p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-all hover-scale">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Desviación
                  </CardTitle>
                  {variance >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-destructive" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-success" />
                  )}
                </CardHeader>
                <CardContent>
                  <div className={cn("text-2xl font-bold", variance >= 0 ? "text-destructive" : "text-success")}>
                    {variance >= 0 ? "+" : ""}
                    {variancePercentage.toFixed(1)}%
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    vs. planificado (€{variance.toLocaleString("es-ES", { maximumFractionDigits: 2 })})
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Comparison Chart */}
            <Card className="animate-fade-in">
              <CardHeader>
                <CardTitle>Costes Planificados vs. Reales por Centro</CardTitle>
                <CardDescription>
                  Comparativa de costes estimados y costes reales
                </CardDescription>
              </CardHeader>
              <CardContent>
                {comparisonData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={comparisonData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="centro" 
                        className="text-xs"
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <YAxis 
                        className="text-xs"
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        tickFormatter={(value) => `€${value.toLocaleString()}`}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                        formatter={(value: number) => `€${value.toLocaleString("es-ES", { maximumFractionDigits: 2 })}`}
                      />
                      <Legend />
                      <Bar 
                        dataKey="costes_planificados" 
                        fill="hsl(var(--chart-3))" 
                        name="Planificado"
                        radius={[8, 8, 0, 0]}
                      />
                      <Bar 
                        dataKey="costes_reales" 
                        fill="hsl(var(--primary))" 
                        name="Real"
                        radius={[8, 8, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                    No hay datos disponibles para el periodo seleccionado
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Detailed Table */}
            <Card className="animate-fade-in">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Desglose Detallado por Empleado</CardTitle>
                    <CardDescription>
                      {payrollData.length} empleado{payrollData.length !== 1 ? "s" : ""} con datos de nómina
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {payrollData.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No hay datos de nómina para el periodo seleccionado
                  </div>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Empleado</TableHead>
                          <TableHead>Centro</TableHead>
                          <TableHead className="text-right">H. Trabajadas</TableHead>
                          <TableHead className="text-right">H. Vacaciones</TableHead>
                          <TableHead className="text-right">H. Formación</TableHead>
                          <TableHead className="text-right">Coste Total</TableHead>
                          <TableHead className="text-right">Coste Medio</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payrollData.map((item) => (
                          <TableRow key={item.employee_id} className="hover:bg-muted/50">
                            <TableCell className="font-medium">
                              {item.employee_name}
                            </TableCell>
                            <TableCell>
                              {item.employee_centro ? (
                                <Badge variant="outline">{item.employee_centro}</Badge>
                              ) : (
                                "-"
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {Number(item.horas_trabajadas).toLocaleString("es-ES", { maximumFractionDigits: 2 })}h
                            </TableCell>
                            <TableCell className="text-right">
                              {Number(item.horas_vacaciones).toLocaleString("es-ES", { maximumFractionDigits: 2 })}h
                            </TableCell>
                            <TableCell className="text-right">
                              {Number(item.horas_formacion).toLocaleString("es-ES", { maximumFractionDigits: 2 })}h
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              €{Number(item.coste_total).toLocaleString("es-ES", { maximumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              €{Number(item.coste_medio).toLocaleString("es-ES", { maximumFractionDigits: 2 })}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Additional Stats */}
            <div className="grid gap-6 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Horas de Vacaciones</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-chart-4">
                    {totalHorasVacaciones.toLocaleString("es-ES", { maximumFractionDigits: 2 })}h
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Total del periodo
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Horas de Formación</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-chart-5">
                    {totalHorasFormacion.toLocaleString("es-ES", { maximumFractionDigits: 2 })}h
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Total del periodo
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Empleados Analizados</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary">
                    {payrollData.length}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Con datos en el periodo
                  </p>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

export default Costs;
