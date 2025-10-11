import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { useCentro } from "@/contexts/CentroContext";
import { useCostAnalysis } from "@/hooks/useCostAnalysis";
import { ExportUtils } from "@/lib/exporters";
import { CostCalculations } from "@/lib/calculations/costCalculations";
import { Formatters } from "@/lib/formatters";
import Layout from "@/components/Layout";
import { PageHeader, LoadingSpinner, EmptyState } from "@/components/common";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Download, DollarSign, Calendar as CalendarIcon, Upload, TrendingUp, TrendingDown } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

const Costs = () => {
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();
  const { selectedCentro } = useCentro();
  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(endOfMonth(new Date()));
  
  const { payrollData, comparisonData, summary, isLoading } = useCostAnalysis(
    startDate,
    endDate,
    selectedCentro
  );

  const exportToCSV = () => {
    ExportUtils.toCSV(
      payrollData,
      [
        { header: "Empleado", accessor: "employee_name" },
        { header: "Centro", accessor: (row) => row.employee_centro || "" },
        { header: "Horas Trabajadas", accessor: (row) => Formatters.formatNumber(row.horas_trabajadas, 2) },
        { header: "Horas Vacaciones", accessor: (row) => Formatters.formatNumber(row.horas_vacaciones, 2) },
        { header: "Horas Formación", accessor: (row) => Formatters.formatNumber(row.horas_formacion, 2) },
        { header: "Coste Total", accessor: (row) => Formatters.formatNumber(row.coste_total, 2) },
        { header: "Coste Medio/Hora", accessor: (row) => Formatters.formatNumber(row.coste_medio, 2) },
      ],
      `costes_${format(startDate, "yyyy-MM-dd")}_${format(endDate, "yyyy-MM-dd")}.csv`
    );
  };

  return (
    <Layout>
      <div className="p-6 space-y-6 animate-fade-in">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <PageHeader
            title="Análisis de Costes"
            description="Seguimiento detallado de costes de personal"
          />

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

        {isLoading ? (
          <LoadingSpinner size="lg" />
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
                    {CostCalculations.formatCurrency(summary.totalCoste)}
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
                    {Formatters.formatNumber(summary.totalHorasTrabajadas, 2)}h
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
                    {CostCalculations.formatCurrency(summary.costeMedio)}
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
                  {summary.variance.isOverBudget ? (
                    <TrendingUp className="h-4 w-4 text-destructive" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-success" />
                  )}
                </CardHeader>
                <CardContent>
                  <div className={cn("text-2xl font-bold", summary.variance.isOverBudget ? "text-destructive" : "text-success")}>
                    {summary.variance.isOverBudget ? "+" : ""}
                    {CostCalculations.formatPercentage(summary.variance.percentage, 1)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    vs. planificado ({CostCalculations.formatCurrency(summary.variance.diff)})
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
                  <EmptyState message="No hay datos disponibles para el periodo seleccionado" />
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
                  <EmptyState message="No hay datos de nómina para el periodo seleccionado" />
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
                              {Formatters.formatNumber(item.horas_trabajadas, 2)}h
                            </TableCell>
                            <TableCell className="text-right">
                              {Formatters.formatNumber(item.horas_vacaciones, 2)}h
                            </TableCell>
                            <TableCell className="text-right">
                              {Formatters.formatNumber(item.horas_formacion, 2)}h
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {CostCalculations.formatCurrency(item.coste_total)}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {CostCalculations.formatCurrency(item.coste_medio)}
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
                    {Formatters.formatNumber(summary.totalHorasVacaciones, 2)}h
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
                    {Formatters.formatNumber(summary.totalHorasFormacion, 2)}h
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
