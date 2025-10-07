import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, DollarSign } from "lucide-react";
import { toast } from "sonner";

interface CostSummary {
  totalCosts: number;
  totalHours: number;
  avgCostPerHour: number;
}

const Costs = () => {
  const [summary, setSummary] = useState<CostSummary>({
    totalCosts: 0,
    totalHours: 0,
    avgCostPerHour: 0,
  });

  useEffect(() => {
    fetchCostSummary();
  }, []);

  const fetchCostSummary = async () => {
    try {
      const { data, error } = await supabase
        .from("payrolls")
        .select("coste_total, horas_trabajadas");

      if (error) throw error;

      const totalCosts = data?.reduce((sum, p) => sum + (Number(p.coste_total) || 0), 0) || 0;
      const totalHours = data?.reduce((sum, p) => sum + (Number(p.horas_trabajadas) || 0), 0) || 0;
      const avgCostPerHour = totalHours > 0 ? totalCosts / totalHours : 0;

      setSummary({
        totalCosts,
        totalHours,
        avgCostPerHour,
      });
    } catch (error) {
      console.error("Error fetching costs:", error);
    }
  };

  const handleExportCSV = () => {
    toast.info("Exportación CSV próximamente disponible");
  };

  return (
    <Layout>
      <div className="p-6 space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Análisis de Costes</h1>
            <p className="text-muted-foreground mt-1">
              Seguimiento detallado de costes de personal
            </p>
          </div>
          <Button onClick={handleExportCSV} className="gap-2">
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Costes Totales
              </CardTitle>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                €{summary.totalCosts.toLocaleString("es-ES", { maximumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Suma de todos los costes de nómina
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Horas Totales
              </CardTitle>
              <DollarSign className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {summary.totalHours.toLocaleString("es-ES", { maximumFractionDigits: 2 })}h
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Total de horas trabajadas
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Coste Promedio/Hora
              </CardTitle>
              <DollarSign className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                €{summary.avgCostPerHour.toLocaleString("es-ES", { maximumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Promedio por hora trabajada
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Desglose de Costes por Centro</CardTitle>
            <CardDescription>
              Análisis detallado de la distribución de costes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[400px] flex items-center justify-center text-muted-foreground border-2 border-dashed border-border rounded-lg">
              <div className="text-center space-y-3">
                <DollarSign className="h-16 w-16 mx-auto opacity-20" />
                <p className="text-lg font-medium">Gráficos de análisis próximamente</p>
                <p className="text-sm">
                  Visualizaciones detalladas de costes por centro y empleado
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Costs;
