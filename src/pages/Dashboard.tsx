import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, Clock, TrendingUp, DollarSign } from "lucide-react";

interface Stats {
  totalEmployees: number;
  activeSchedules: number;
  totalAbsences: number;
  totalCosts: number;
}

const Dashboard = () => {
  const [stats, setStats] = useState<Stats>({
    totalEmployees: 0,
    activeSchedules: 0,
    totalAbsences: 0,
    totalCosts: 0,
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [employeesRes, schedulesRes, absencesRes, payrollsRes] = await Promise.all([
        supabase.from("employees").select("id", { count: "exact" }),
        supabase.from("schedules").select("id", { count: "exact" }),
        supabase.from("absences").select("id", { count: "exact" }),
        supabase.from("payrolls").select("coste_total"),
      ]);

      const totalCosts = payrollsRes.data?.reduce(
        (sum, p) => sum + (Number(p.coste_total) || 0),
        0
      ) || 0;

      setStats({
        totalEmployees: employeesRes.count || 0,
        activeSchedules: schedulesRes.count || 0,
        totalAbsences: absencesRes.count || 0,
        totalCosts,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const statCards = [
    {
      title: "Total Empleados",
      value: stats.totalEmployees,
      icon: Users,
      description: "Empleados activos en el sistema",
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Turnos Programados",
      value: stats.activeSchedules,
      icon: Clock,
      description: "Asignaciones de turnos registradas",
      color: "text-success",
      bgColor: "bg-success/10",
    },
    {
      title: "Ausencias Totales",
      value: stats.totalAbsences,
      icon: TrendingUp,
      description: "Incidencias y ausencias registradas",
      color: "text-warning",
      bgColor: "bg-warning/10",
    },
    {
      title: "Costes Totales",
      value: `€${stats.totalCosts.toLocaleString("es-ES", { maximumFractionDigits: 2 })}`,
      icon: DollarSign,
      description: "Costes totales de nómina",
      color: "text-destructive",
      bgColor: "bg-destructive/10",
    },
  ];

  return (
    <Layout>
      <div className="p-6 space-y-6 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Visión general de la gestión de personal
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat) => (
            <Card key={stat.title} className="hover:shadow-md transition-shadow">
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

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Resumen de Planificación</CardTitle>
              <CardDescription>
                Comparativa de horas planificadas vs. trabajadas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                Datos de comparativa próximamente disponibles
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Análisis de Absentismo</CardTitle>
              <CardDescription>
                Tendencias de ausencias por mes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                Gráfico de tendencias próximamente disponible
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Distribución de Costes por Centro</CardTitle>
            <CardDescription>
              Desglose de costes de personal por ubicación
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              Visualización de costes próximamente disponible
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Dashboard;
