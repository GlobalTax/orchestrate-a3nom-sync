import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, UserPlus, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

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

const Employees = () => {
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCentro, setSelectedCentro] = useState<string>("all");
  const [centros, setCentros] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEmployees();
    fetchCentros();
  }, []);

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .order("apellidos", { ascending: true });

      if (error) throw error;
      setEmployees(data || []);
    } catch (error: any) {
      toast.error("Error al cargar empleados");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCentros = async () => {
    try {
      const { data, error } = await supabase.rpc("get_centros");
      if (error) throw error;
      setCentros(data?.map((c: { centro: string }) => c.centro) || []);
    } catch (error: any) {
      console.error("Error fetching centros:", error);
    }
  };

  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.apellidos.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCentro = selectedCentro === "all" || emp.centro === selectedCentro;
    
    return matchesSearch && matchesCentro;
  });

  const exportToCSV = () => {
    if (filteredEmployees.length === 0) {
      toast.error("No hay datos para exportar");
      return;
    }

    const headers = ["Nombre", "Apellidos", "Email", "Centro", "Fecha Alta", "Estado"];
    const rows = filteredEmployees.map((emp) => [
      emp.nombre,
      emp.apellidos,
      emp.email || "",
      emp.centro || "",
      emp.fecha_alta ? new Date(emp.fecha_alta).toLocaleDateString("es-ES") : "",
      emp.fecha_baja ? "Inactivo" : "Activo",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `empleados_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("Datos exportados correctamente");
  };

  const handleRowClick = (employeeId: string) => {
    navigate(`/employees/${employeeId}`);
  };

  return (
    <Layout>
      <div className="p-6 space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Empleados</h1>
            <p className="text-muted-foreground mt-1">
              Gestiona tu equipo de trabajo
            </p>
          </div>
          <Button className="gap-2">
            <UserPlus className="h-4 w-4" />
            Nuevo Empleado
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <CardTitle>Lista de Empleados ({filteredEmployees.length})</CardTitle>
              <Button variant="outline" onClick={exportToCSV} className="gap-2">
                <Download className="h-4 w-4" />
                Exportar CSV
              </Button>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre, apellidos o email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={selectedCentro} onValueChange={setSelectedCentro}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Filtrar por centro" />
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
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredEmployees.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No se encontraron empleados
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre Completo</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Centro</TableHead>
                      <TableHead>Fecha Alta</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEmployees.map((employee) => (
                      <TableRow 
                        key={employee.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => handleRowClick(employee.id)}
                      >
                        <TableCell className="font-medium">
                          {employee.nombre} {employee.apellidos}
                        </TableCell>
                        <TableCell>{employee.email || "-"}</TableCell>
                        <TableCell>
                          {employee.centro ? (
                            <Badge variant="outline">{employee.centro}</Badge>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>
                          {employee.fecha_alta
                            ? new Date(employee.fecha_alta).toLocaleDateString("es-ES")
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={employee.fecha_baja ? "destructive" : "default"}
                            className={
                              employee.fecha_baja
                                ? ""
                                : "bg-success hover:bg-success/80"
                            }
                          >
                            {employee.fecha_baja ? "Inactivo" : "Activo"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Employees;
