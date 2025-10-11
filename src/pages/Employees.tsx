import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { useEmployees } from "@/hooks/useEmployees";
import { useEmployeeCentros } from "@/hooks/useEmployeeCentros";
import { useTableState } from "@/hooks/useTableState";
import { ExportUtils } from "@/lib/exporters";
import { Formatters } from "@/lib/formatters";
import Layout from "@/components/Layout";
import { PageHeader, LoadingSpinner, EmptyState } from "@/components/common";
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
import { Search, UserPlus, Download } from "lucide-react";
import { Employee } from "@/services/api/employees.service";

const Employees = () => {
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();
  const [selectedCentro, setSelectedCentro] = useState<string>("all");
  
  const { employees, isLoading } = useEmployees();
  const { centros } = useEmployeeCentros();

  const { paginatedData, searchQuery, setSearchQuery, filteredData } = useTableState({
    data: employees,
    initialPageSize: 100,
    searchFields: ["nombre", "apellidos", "email"],
  });

  // Apply centro filter to paginated data
  const displayedEmployees = paginatedData.filter((emp) => 
    selectedCentro === "all" || emp.centro === selectedCentro
  );

  const exportToCSV = () => {
    ExportUtils.toCSV(
      displayedEmployees,
      [
        { header: "Nombre", accessor: "nombre" },
        { header: "Apellidos", accessor: "apellidos" },
        { header: "Email", accessor: (row) => row.email || "" },
        { header: "Centro", accessor: (row) => row.centro || "" },
        { header: "Fecha Alta", accessor: (row) => Formatters.formatDate(row.fecha_alta) },
        { header: "Estado", accessor: (row) => row.fecha_baja ? "Inactivo" : "Activo" },
      ],
      `empleados_${Formatters.formatDate(new Date(), "YYYY-MM-DD")}.csv`
    );
  };

  const handleRowClick = (employeeId: string) => {
    navigate(`/employees/${employeeId}`);
  };

  return (
    <Layout>
      <div className="p-6 space-y-6 animate-fade-in">
        <PageHeader
          title="Empleados"
          description="Gestiona tu equipo de trabajo"
          action={{
            label: "Nuevo Empleado",
            onClick: () => {},
            icon: <UserPlus className="h-4 w-4 mr-2" />,
          }}
        />

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <CardTitle>Lista de Empleados ({displayedEmployees.length})</CardTitle>
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
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
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
            {isLoading ? (
              <LoadingSpinner size="lg" />
            ) : displayedEmployees.length === 0 ? (
              <EmptyState message="No se encontraron empleados" />
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
                    {displayedEmployees.map((employee) => (
                      <TableRow 
                        key={employee.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => handleRowClick(employee.id)}
                      >
                        <TableCell className="font-medium">
                          {Formatters.formatFullName(employee.nombre, employee.apellidos)}
                        </TableCell>
                        <TableCell>{Formatters.formatEmail(employee.email)}</TableCell>
                        <TableCell>
                          {employee.centro ? (
                            <Badge variant="outline">{employee.centro}</Badge>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>
                          {Formatters.formatDate(employee.fecha_alta)}
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
