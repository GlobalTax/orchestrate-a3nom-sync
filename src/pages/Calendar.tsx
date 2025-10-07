import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarIcon, Plus } from "lucide-react";

const Calendar = () => {
  return (
    <Layout>
      <div className="p-6 space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Calendario</h1>
            <p className="text-muted-foreground mt-1">
              Planificación de turnos y ausencias
            </p>
          </div>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Nuevo Turno
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Vista de Calendario
            </CardTitle>
            <CardDescription>
              Visualiza y gestiona los turnos programados y las ausencias del equipo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[600px] flex items-center justify-center text-muted-foreground border-2 border-dashed border-border rounded-lg">
              <div className="text-center space-y-3">
                <CalendarIcon className="h-16 w-16 mx-auto opacity-20" />
                <p className="text-lg font-medium">Vista de calendario próximamente</p>
                <p className="text-sm">
                  Aquí podrás visualizar y editar turnos, ausencias y disponibilidades
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Calendar;
