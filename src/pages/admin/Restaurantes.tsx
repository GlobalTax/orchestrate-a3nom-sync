import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import Layout from "@/components/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { 
  Building2, Plus, Pencil, Power, PowerOff, Loader2, RefreshCw, Wifi, Info, 
  Server, DollarSign, Edit, X, ArrowRight, Users, UserPlus, Trash2, Upload
} from "lucide-react";

interface Centre {
  id: string;
  codigo: string;
  nombre: string;
  direccion: string | null;
  ciudad: string | null;
  pais: string;
  orquest_service_id: string | null;
  orquest_business_id: string | null;
  activo: boolean;
}

interface RestaurantService {
  id: string;
  centro_id: string;
  orquest_service_id: string;
  descripcion: string | null;
  activo: boolean;
  centres: {
    codigo: string;
    nombre: string;
  };
}

interface CostCentre {
  id: string;
  centro_id: string;
  a3_centro_code: string;
  descripcion: string | null;
  activo: boolean;
  centres: {
    codigo: string;
    nombre: string;
  };
}

const Restaurantes = () => {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState("general");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [costCentreDialogOpen, setCostCentreDialogOpen] = useState(false);
  const [franchiseeDialogOpen, setFranchiseeDialogOpen] = useState(false);
  const [testingCentre, setTestingCentre] = useState<string | null>(null);
  const [editingCentre, setEditingCentre] = useState<Centre | null>(null);
  const [editingService, setEditingService] = useState<RestaurantService | null>(null);
  const [editingCostCentre, setEditingCostCentre] = useState<CostCentre | null>(null);
  const [selectedCentroForFranchisee, setSelectedCentroForFranchisee] = useState<string>("");
  
  const [centreFormData, setCentreFormData] = useState({
    codigo: "",
    nombre: "",
    direccion: "",
    ciudad: "",
    pais: "España",
    postal_code: "",
    state: "",
    site_number: "",
    franchisee_name: "",
    franchisee_email: "",
    company_tax_id: "",
    seating_capacity: null as number | null,
    square_meters: null as number | null,
    opening_date: null as string | null,
    orquest_business_id: "",
    orquest_service_id: "",
  });

  const [serviceFormData, setServiceFormData] = useState({
    centro_id: "",
    orquest_service_id: "",
    descripcion: "",
  });

  const [costCentreFormData, setCostCentreFormData] = useState({
    centro_id: "",
    a3_centro_code: "",
    descripcion: "",
  });

  // Fetch centres/restaurants
  const { data: centres = [], isLoading: loadingCentres } = useQuery({
    queryKey: ["centres"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("centres")
        .select("*")
        .order("nombre");
      if (error) throw error;
      return data as Centre[];
    },
    enabled: isAdmin,
  });

  // Fetch services count per restaurant
  const { data: servicesCount = {} } = useQuery({
    queryKey: ["services_count"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurant_services")
        .select("centro_id")
        .eq("activo", true);
      
      if (error) throw error;
      
      return data.reduce((acc, curr) => {
        acc[curr.centro_id] = (acc[curr.centro_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
    },
    enabled: isAdmin,
  });

  // Fetch all services
  const { data: restaurantServices = [], isLoading: loadingServices } = useQuery({
    queryKey: ["restaurant_services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurant_services")
        .select(`
          *,
          centres:centro_id (
            codigo,
            nombre
          )
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as RestaurantService[];
    },
    enabled: isAdmin,
  });

  // Fetch cost centres
  const { data: costCentres = [], isLoading: loadingCostCentres } = useQuery({
    queryKey: ["cost_centres"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurant_cost_centres")
        .select(`
          *,
          centres:centro_id (
            codigo,
            nombre
          )
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as CostCentre[];
    },
    enabled: isAdmin,
  });

  // Fetch users with their roles
  const { data: usersWithRoles = [], isLoading: loadingUsers } = useQuery({
    queryKey: ["users_with_roles"],
    queryFn: async () => {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*");
      
      if (profilesError) throw profilesError;

      const { data: userRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("*");
      
      if (rolesError) throw rolesError;

      return (profiles || []).map(profile => ({
        id: profile.id,
        email: profile.email || "",
        nombre: profile.nombre || "",
        apellidos: profile.apellidos || "",
        roles: userRoles?.filter(ur => ur.user_id === profile.id) || [],
      }));
    },
    enabled: isAdmin,
  });

  // Group franchisees by centro
  const franchiseesByCentro = usersWithRoles.reduce((acc, user) => {
    const gestorRoles = user.roles.filter(r => r.role === "gestor");
    gestorRoles.forEach(role => {
      if (role.centro) {
        if (!acc[role.centro]) {
          acc[role.centro] = [];
        }
        acc[role.centro].push({
          userId: user.id,
          email: user.email,
          nombre: user.nombre,
          apellidos: user.apellidos,
          roleId: role.id,
        });
      }
    });
    return acc;
  }, {} as Record<string, Array<{ userId: string; email: string; nombre: string; apellidos: string; roleId: string }>>);

  // Group services by restaurant
  const servicesByRestaurant = restaurantServices?.reduce((acc, service) => {
    const key = service.centro_id;
    if (!acc[key]) {
      acc[key] = {
        restaurant: service.centres,
        services: [],
      };
    }
    acc[key].services.push(service);
    return acc;
  }, {} as Record<string, { restaurant: any; services: RestaurantService[] }>);

  // Mutations for centres
  const saveCentreMutation = useMutation({
    mutationFn: async (data: typeof centreFormData) => {
      if (editingCentre) {
        const { error } = await supabase
          .from("centres")
          .update(data)
          .eq("id", editingCentre.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("centres")
          .insert([{ ...data, activo: true }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["centres"] });
      toast.success(editingCentre ? "Restaurante actualizado" : "Restaurante creado");
      resetCentreForm();
    },
    onError: (error: any) => {
      toast.error("Error al guardar: " + error.message);
    },
  });

  const toggleCentreActiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const centre = centres.find(c => c.id === id);
      if (!centre) return;
      const { error } = await supabase
        .from("centres")
        .update({ activo: !centre.activo })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["centres"] });
      toast.success("Estado actualizado");
    },
    onError: (error: any) => {
      toast.error("Error: " + error.message);
    },
  });

  // Mutations for services
  const saveServiceMutation = useMutation({
    mutationFn: async (data: typeof serviceFormData) => {
      if (editingService) {
        const { error } = await supabase
          .from("restaurant_services")
          .update(data)
          .eq("id", editingService.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("restaurant_services")
          .insert([data]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restaurant_services"] });
      queryClient.invalidateQueries({ queryKey: ["services_count"] });
      toast.success(editingService ? "Service actualizado" : "Service creado");
      resetServiceForm();
    },
    onError: (error: any) => {
      toast.error("Error: " + error.message);
    },
  });

  const toggleServiceActiveMutation = useMutation({
    mutationFn: async ({ id, activo }: { id: string; activo: boolean }) => {
      const { error } = await supabase
        .from("restaurant_services")
        .update({ activo })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restaurant_services"] });
      queryClient.invalidateQueries({ queryKey: ["services_count"] });
      toast.success("Estado actualizado");
    },
    onError: (error: any) => {
      toast.error("Error: " + error.message);
    },
  });

  // Mutations for cost centres
  const saveCostCentreMutation = useMutation({
    mutationFn: async (data: typeof costCentreFormData) => {
      if (editingCostCentre) {
        const { error } = await supabase
          .from("restaurant_cost_centres")
          .update(data)
          .eq("id", editingCostCentre.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("restaurant_cost_centres")
          .insert([{ ...data, activo: true }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cost_centres"] });
      toast.success(editingCostCentre ? "Centro de coste actualizado" : "Centro de coste creado");
      resetCostCentreForm();
    },
    onError: (error: any) => {
      toast.error("Error: " + error.message);
    },
  });

  const toggleCostCentreActiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const costCentre = costCentres.find(c => c.id === id);
      if (!costCentre) return;
      const { error } = await supabase
        .from("restaurant_cost_centres")
        .update({ activo: !costCentre.activo })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cost_centres"] });
      toast.success("Estado actualizado");
    },
    onError: (error: any) => {
      toast.error("Error: " + error.message);
    },
  });

  // Test connection
  const testConnection = async (centreId: string) => {
    const centre = centres.find(c => c.id === centreId);
    if (!centre) return;

    setTestingCentre(centreId);
    try {
      const { data, error } = await supabase.functions.invoke("test_orquest_connection", {
        body: {
          service_id: centre.orquest_service_id,
          business_id: centre.orquest_business_id,
        },
      });

      if (error) throw error;

      if (data.success) {
        toast.success(`✅ Conexión exitosa: ${data.employees_count} empleados encontrados`);
      } else {
        toast.error("Error en la conexión: " + data.message);
      }
    } catch (error: any) {
      toast.error("Error al probar conexión: " + error.message);
    } finally {
      setTestingCentre(null);
    }
  };

  // Form handlers
  const resetCentreForm = () => {
    setCentreFormData({
      codigo: "",
      nombre: "",
      direccion: "",
      ciudad: "",
      pais: "España",
      postal_code: "",
      state: "",
      site_number: "",
      franchisee_name: "",
      franchisee_email: "",
      company_tax_id: "",
      seating_capacity: null,
      square_meters: null,
      opening_date: null,
      orquest_business_id: "",
      orquest_service_id: "",
    });
    setEditingCentre(null);
    setDialogOpen(false);
  };

  const resetServiceForm = () => {
    setServiceFormData({
      centro_id: "",
      orquest_service_id: "",
      descripcion: "",
    });
    setEditingService(null);
    setServiceDialogOpen(false);
  };

  const resetCostCentreForm = () => {
    setCostCentreFormData({
      centro_id: "",
      a3_centro_code: "",
      descripcion: "",
    });
    setEditingCostCentre(null);
    setCostCentreDialogOpen(false);
  };

  const handleEditCentre = (centre: Centre) => {
    setEditingCentre(centre);
    setCentreFormData({
      codigo: centre.codigo,
      nombre: centre.nombre,
      direccion: centre.direccion || "",
      ciudad: centre.ciudad || "",
      pais: centre.pais,
      postal_code: (centre as any).postal_code || "",
      state: (centre as any).state || "",
      site_number: (centre as any).site_number || "",
      franchisee_name: (centre as any).franchisee_name || "",
      franchisee_email: (centre as any).franchisee_email || "",
      company_tax_id: (centre as any).company_tax_id || "",
      seating_capacity: (centre as any).seating_capacity || null,
      square_meters: (centre as any).square_meters || null,
      opening_date: (centre as any).opening_date || null,
      orquest_business_id: centre.orquest_business_id || "",
      orquest_service_id: centre.orquest_service_id || "",
    });
    setDialogOpen(true);
  };

  const handleEditService = (service: RestaurantService) => {
    setEditingService(service);
    setServiceFormData({
      centro_id: service.centro_id,
      orquest_service_id: service.orquest_service_id,
      descripcion: service.descripcion || "",
    });
    setServiceDialogOpen(true);
  };

  const handleEditCostCentre = (costCentre: CostCentre) => {
    setEditingCostCentre(costCentre);
    setCostCentreFormData({
      centro_id: costCentre.centro_id,
      a3_centro_code: costCentre.a3_centro_code,
      descripcion: costCentre.descripcion || "",
    });
    setCostCentreDialogOpen(true);
  };

  // Mutation to assign franchisee
  const assignFranchiseeMutation = useMutation({
    mutationFn: async ({ userId, centroCodigo }: { userId: string; centroCodigo: string }) => {
      const { error } = await supabase
        .from("user_roles")
        .insert({
          user_id: userId,
          role: "gestor",
          centro: centroCodigo,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users_with_roles"] });
      toast.success("Franquiciado asignado correctamente");
      setFranchiseeDialogOpen(false);
      setSelectedCentroForFranchisee("");
    },
    onError: (error: any) => {
      toast.error("Error al asignar franquiciado: " + error.message);
    },
  });

  // Mutation to remove franchisee
  const removeFranchiseeMutation = useMutation({
    mutationFn: async (roleId: string) => {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("id", roleId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users_with_roles"] });
      toast.success("Franquiciado removido correctamente");
    },
    onError: (error: any) => {
      toast.error("Error al remover franquiciado: " + error.message);
    },
  });

  if (roleLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!isAdmin) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <Alert variant="destructive">
            <AlertTitle>Acceso Denegado</AlertTitle>
            <AlertDescription>
              No tienes permisos para acceder a esta página
            </AlertDescription>
          </Alert>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-6 animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Building2 className="h-8 w-8" />
              Gestión de Restaurantes
            </h1>
            <p className="text-muted-foreground mt-1">
              Administra restaurantes, services de Orquest y centros de coste A3Nom
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="general">Datos Generales</TabsTrigger>
            <TabsTrigger value="franchisees">Franquiciados</TabsTrigger>
            <TabsTrigger value="services">Services Orquest</TabsTrigger>
            <TabsTrigger value="cost-centres">Centros de Coste A3</TabsTrigger>
          </TabsList>

          {/* TAB: Datos Generales */}
          <TabsContent value="general" className="space-y-6">
            <div className="flex justify-end">
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo Restaurante
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Restaurantes Registrados</CardTitle>
                <CardDescription>
                  {centres.length} restaurante{centres.length !== 1 ? "s" : ""} en el sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingCentres ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Ciudad</TableHead>
                        <TableHead>Business ID</TableHead>
                        <TableHead>Services</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {centres.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                            No hay restaurantes registrados
                          </TableCell>
                        </TableRow>
                      ) : (
                        centres.map((centre) => (
                          <TableRow key={centre.id}>
                            <TableCell>
                              <Badge variant="outline" className="font-mono">
                                {centre.codigo}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium">{centre.nombre}</TableCell>
                            <TableCell>{centre.ciudad || "N/A"}</TableCell>
                            <TableCell>
                              <code className="text-xs bg-muted px-2 py-1 rounded">
                                {centre.orquest_business_id || "N/A"}
                              </code>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary">
                                  {servicesCount[centre.id] || 0} service{servicesCount[centre.id] !== 1 ? "s" : ""}
                                </Badge>
                                {servicesCount[centre.id] > 0 && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setActiveTab("services")}
                                  >
                                    <ArrowRight className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={centre.activo ? "default" : "secondary"}>
                                {centre.activo ? "Activo" : "Inactivo"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {centre.orquest_business_id && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => testConnection(centre.id)}
                                    disabled={testingCentre === centre.id}
                                  >
                                    {testingCentre === centre.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Wifi className="h-4 w-4" />
                                    )}
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleEditCentre(centre)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => toggleCentreActiveMutation.mutate(centre.id)}
                                  disabled={toggleCentreActiveMutation.isPending}
                                >
                                  {centre.activo ? (
                                    <PowerOff className="h-4 w-4 text-red-600" />
                                  ) : (
                                    <Power className="h-4 w-4 text-green-600" />
                                  )}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB: Franquiciados/Gestores */}
          <TabsContent value="franchisees" className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
              <Alert className="flex-1">
                <Info className="h-4 w-4" />
                <AlertTitle>Gestión de Franquiciados</AlertTitle>
                <AlertDescription>
                  Los franquiciados (gestores) tienen acceso limitado a los datos de su restaurante asignado.
                  Desde aquí puedes asignar gestores a cada restaurante.
                </AlertDescription>
              </Alert>
              <div className="flex gap-2">
                <Button
                  onClick={() => window.location.href = '/admin/import-restaurants'}
                  variant="outline"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Importar CSV
                </Button>
                <Button
                  onClick={async () => {
                    try {
                      toast.info("Iniciando asignación automática...");
                      const { data, error } = await supabase.functions.invoke("assign_franchisees");
                      if (error) throw error;
                      toast.success(`✅ ${data.created_users} usuarios creados, ${data.roles_assigned} roles asignados`);
                      queryClient.invalidateQueries({ queryKey: ["users_with_roles"] });
                    } catch (error: any) {
                      toast.error("Error: " + error.message);
                    }
                  }}
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  Auto-asignar
                </Button>
              </div>
            </div>

            {loadingUsers || loadingCentres ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <Accordion type="multiple" className="space-y-4">
                {centres.map((centre) => {
                  const franchisees = franchiseesByCentro[centre.codigo] || [];
                  return (
                    <AccordionItem
                      key={centre.id}
                      value={centre.id}
                      className="border rounded-lg bg-card"
                    >
                      <AccordionTrigger className="px-6 hover:no-underline">
                        <div className="flex items-center gap-3">
                          <Users className="h-5 w-5 text-primary" />
                          <div className="text-left">
                            <div className="font-semibold">{centre.nombre}</div>
                            <div className="text-sm text-muted-foreground">
                              {centre.codigo} • {franchisees.length} franquiciado{franchisees.length !== 1 ? "s" : ""}
                            </div>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-6 pb-4">
                        <div className="space-y-3 pt-3">
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedCentroForFranchisee(centre.codigo);
                              setFranchiseeDialogOpen(true);
                            }}
                          >
                            <UserPlus className="h-4 w-4 mr-2" />
                            Añadir Franquiciado
                          </Button>

                          {franchisees.length === 0 ? (
                            <div className="text-center text-muted-foreground py-8">
                              No hay franquiciados asignados a este restaurante
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {franchisees.map((franchisee) => (
                                <Card key={franchisee.roleId}>
                                  <CardContent className="p-4">
                                    <div className="flex items-center justify-between">
                                      <div>
                                        <div className="font-medium">
                                          {franchisee.nombre} {franchisee.apellidos}
                                        </div>
                                        <div className="text-sm text-muted-foreground">
                                          {franchisee.email}
                                        </div>
                                      </div>
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => removeFranchiseeMutation.mutate(franchisee.roleId)}
                                        disabled={removeFranchiseeMutation.isPending}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            )}
          </TabsContent>

          {/* TAB: Services Orquest */}
          <TabsContent value="services" className="space-y-6">
            <div className="flex justify-between items-center">
              <Alert className="flex-1 mr-4">
                <Info className="h-4 w-4" />
                <AlertTitle>¿Qué son los Services?</AlertTitle>
                <AlertDescription>
                  Los Services de Orquest representan secciones operativas dentro de un
                  restaurante (ej: cocina, salón, barra). Un restaurante puede tener
                  múltiples services para organizar mejor la planificación.
                </AlertDescription>
              </Alert>
              <Button onClick={() => setServiceDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Añadir Service
              </Button>
            </div>

            {loadingServices ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <Accordion type="multiple" className="space-y-4">
                {servicesByRestaurant && Object.entries(servicesByRestaurant).map(([centroId, { restaurant, services }]) => (
                  <AccordionItem
                    key={centroId}
                    value={centroId}
                    className="border rounded-lg bg-card"
                  >
                    <AccordionTrigger className="px-6 hover:no-underline">
                      <div className="flex items-center gap-3">
                        <Server className="h-5 w-5 text-primary" />
                        <div className="text-left">
                          <div className="font-semibold">{restaurant.nombre}</div>
                          <div className="text-sm text-muted-foreground">
                            {restaurant.codigo} • {services.length} service{services.length !== 1 ? "s" : ""}
                          </div>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pb-4">
                      <div className="space-y-3 pt-3">
                        {services.map((service) => (
                          <Card key={service.id}>
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                                      {service.orquest_service_id}
                                    </code>
                                    <Badge variant={service.activo ? "default" : "secondary"}>
                                      {service.activo ? "Activo" : "Inactivo"}
                                    </Badge>
                                  </div>
                                  {service.descripcion && (
                                    <p className="text-sm text-muted-foreground mt-2">
                                      {service.descripcion}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleEditService(service)}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant={service.activo ? "destructive" : "default"}
                                    onClick={() =>
                                      toggleServiceActiveMutation.mutate({
                                        id: service.id,
                                        activo: !service.activo,
                                      })
                                    }
                                  >
                                    {service.activo ? (
                                      <X className="h-4 w-4" />
                                    ) : (
                                      "Activar"
                                    )}
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </TabsContent>

          {/* TAB: Centros de Coste A3 */}
          <TabsContent value="cost-centres" className="space-y-6">
            <div className="flex justify-between items-center">
              <Alert className="flex-1 mr-4">
                <Info className="h-4 w-4" />
                <AlertTitle>¿Para qué sirven los Centros de Coste?</AlertTitle>
                <AlertDescription>
                  Los centros de coste de A3Nom se mapean a restaurantes. Un restaurante puede
                  tener múltiples centros de coste si su contabilidad está distribuida.
                </AlertDescription>
              </Alert>
              <Button onClick={() => setCostCentreDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo Centro de Coste
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Centros de Coste Registrados</CardTitle>
                <CardDescription>
                  {costCentres.length} centro{costCentres.length !== 1 ? "s" : ""} de coste
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingCostCentres ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Restaurante</TableHead>
                        <TableHead>Código Restaurante</TableHead>
                        <TableHead>Código A3</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {costCentres.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            No hay centros de coste registrados
                          </TableCell>
                        </TableRow>
                      ) : (
                        costCentres.map((costCentre) => (
                          <TableRow key={costCentre.id}>
                            <TableCell className="font-medium">
                              {costCentre.centres?.nombre || "N/A"}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="font-mono">
                                {costCentre.centres?.codigo || "N/A"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <code className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                                {costCentre.a3_centro_code}
                              </code>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-muted-foreground">
                                {costCentre.descripcion || "Sin descripción"}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge variant={costCentre.activo ? "default" : "secondary"}>
                                {costCentre.activo ? "Activo" : "Inactivo"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleEditCostCentre(costCentre)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => toggleCostCentreActiveMutation.mutate(costCentre.id)}
                                  disabled={toggleCostCentreActiveMutation.isPending}
                                >
                                  <Power
                                    className={`h-4 w-4 ${
                                      costCentre.activo ? "text-green-600" : "text-gray-400"
                                    }`}
                                  />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Dialog: Nuevo/Editar Restaurante */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingCentre ? "Editar Restaurante" : "Nuevo Restaurante"}
              </DialogTitle>
              <DialogDescription>
                Completa la información del restaurante y su configuración Orquest
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveCentreMutation.mutate(centreFormData);
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="codigo">
                    Código <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="codigo"
                    value={centreFormData.codigo}
                    onChange={(e) =>
                      setCentreFormData({ ...centreFormData, codigo: e.target.value })
                    }
                    placeholder="Ej: MAD-001"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="site_number">Site Number</Label>
                  <Input
                    id="site_number"
                    value={centreFormData.site_number}
                    onChange={(e) =>
                      setCentreFormData({ ...centreFormData, site_number: e.target.value })
                    }
                    placeholder="Ej: 12345"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="nombre">
                  Nombre <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="nombre"
                  value={centreFormData.nombre}
                  onChange={(e) =>
                    setCentreFormData({ ...centreFormData, nombre: e.target.value })
                  }
                  placeholder="Ej: McDonald's Madrid Centro"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="direccion">Dirección</Label>
                <Input
                  id="direccion"
                  value={centreFormData.direccion}
                  onChange={(e) =>
                    setCentreFormData({ ...centreFormData, direccion: e.target.value })
                  }
                  placeholder="Calle, número"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ciudad">Ciudad</Label>
                  <Input
                    id="ciudad"
                    value={centreFormData.ciudad}
                    onChange={(e) =>
                      setCentreFormData({ ...centreFormData, ciudad: e.target.value })
                    }
                    placeholder="Madrid"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">Provincia</Label>
                  <Input
                    id="state"
                    value={centreFormData.state}
                    onChange={(e) =>
                      setCentreFormData({ ...centreFormData, state: e.target.value })
                    }
                    placeholder="Madrid"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postal_code">Código Postal</Label>
                  <Input
                    id="postal_code"
                    value={centreFormData.postal_code}
                    onChange={(e) =>
                      setCentreFormData({ ...centreFormData, postal_code: e.target.value })
                    }
                    placeholder="28001"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pais">País</Label>
                <Input
                  id="pais"
                  value={centreFormData.pais}
                  onChange={(e) =>
                    setCentreFormData({ ...centreFormData, pais: e.target.value })
                  }
                  placeholder="España"
                />
              </div>

              <div className="border-t pt-4 space-y-4">
                <h3 className="font-semibold text-sm">Información del Franquiciado</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="franchisee_name">Nombre Franquiciado</Label>
                    <Input
                      id="franchisee_name"
                      value={centreFormData.franchisee_name}
                      onChange={(e) =>
                        setCentreFormData({ ...centreFormData, franchisee_name: e.target.value })
                      }
                      placeholder="Nombre completo"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="franchisee_email">Email Franquiciado</Label>
                    <Input
                      id="franchisee_email"
                      type="email"
                      value={centreFormData.franchisee_email}
                      onChange={(e) =>
                        setCentreFormData({ ...centreFormData, franchisee_email: e.target.value })
                      }
                      placeholder="email@example.com"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-4 space-y-4">
                <h3 className="font-semibold text-sm">Detalles del Local</h3>
                
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="company_tax_id">NIF/CIF</Label>
                    <Input
                      id="company_tax_id"
                      value={centreFormData.company_tax_id}
                      onChange={(e) =>
                        setCentreFormData({ ...centreFormData, company_tax_id: e.target.value })
                      }
                      placeholder="A12345678"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="seating_capacity">Capacidad</Label>
                    <Input
                      id="seating_capacity"
                      type="number"
                      value={centreFormData.seating_capacity || ""}
                      onChange={(e) =>
                        setCentreFormData({ 
                          ...centreFormData, 
                          seating_capacity: e.target.value ? parseInt(e.target.value) : null 
                        })
                      }
                      placeholder="Ej: 50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="square_meters">M² Superficie</Label>
                    <Input
                      id="square_meters"
                      type="number"
                      step="0.01"
                      value={centreFormData.square_meters || ""}
                      onChange={(e) =>
                        setCentreFormData({ 
                          ...centreFormData, 
                          square_meters: e.target.value ? parseFloat(e.target.value) : null 
                        })
                      }
                      placeholder="Ej: 150.5"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="opening_date">Fecha Apertura</Label>
                  <Input
                    id="opening_date"
                    type="date"
                    value={centreFormData.opening_date || ""}
                    onChange={(e) =>
                      setCentreFormData({ ...centreFormData, opening_date: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="border-t pt-4 space-y-4">
                <h3 className="font-semibold text-sm">Configuración Orquest</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="orquest_business_id">Business ID</Label>
                    <Input
                      id="orquest_business_id"
                      value={centreFormData.orquest_business_id}
                      onChange={(e) =>
                        setCentreFormData({
                          ...centreFormData,
                          orquest_business_id: e.target.value,
                        })
                      }
                      placeholder="Ej: B001"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="orquest_service_id">Service ID</Label>
                    <Input
                      id="orquest_service_id"
                      value={centreFormData.orquest_service_id}
                      onChange={(e) =>
                        setCentreFormData({
                          ...centreFormData,
                          orquest_service_id: e.target.value,
                        })
                      }
                      placeholder="Ej: S001"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Los services también se pueden configurar en la pestaña "Services Orquest"
                </p>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetCentreForm}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saveCentreMutation.isPending}>
                  {saveCentreMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {editingCentre ? "Actualizar" : "Crear"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Dialog: Nuevo/Editar Service */}
        <Dialog open={serviceDialogOpen} onOpenChange={setServiceDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingService ? "Editar Service" : "Añadir Nuevo Service"}
              </DialogTitle>
              <DialogDescription>
                {editingService
                  ? "Modifica la información del service"
                  : "Asocia un nuevo service de Orquest a un restaurante"}
              </DialogDescription>
            </DialogHeader>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveServiceMutation.mutate(serviceFormData);
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="service_centro_id">Restaurante</Label>
                <Select
                  value={serviceFormData.centro_id}
                  onValueChange={(val) =>
                    setServiceFormData({ ...serviceFormData, centro_id: val })
                  }
                >
                  <SelectTrigger id="service_centro_id">
                    <SelectValue placeholder="Seleccionar restaurante" />
                  </SelectTrigger>
                  <SelectContent>
                    {centres.map((centre) => (
                      <SelectItem key={centre.id} value={centre.id}>
                        {centre.nombre} ({centre.codigo})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="orquest_service_id">Service ID de Orquest</Label>
                <Input
                  id="orquest_service_id"
                  value={serviceFormData.orquest_service_id}
                  onChange={(e) =>
                    setServiceFormData({
                      ...serviceFormData,
                      orquest_service_id: e.target.value,
                    })
                  }
                  placeholder="ej: S001"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="service_descripcion">Descripción (opcional)</Label>
                <Textarea
                  id="service_descripcion"
                  value={serviceFormData.descripcion}
                  onChange={(e) =>
                    setServiceFormData({
                      ...serviceFormData,
                      descripcion: e.target.value,
                    })
                  }
                  placeholder="ej: Cocina principal"
                  rows={3}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetServiceForm}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saveServiceMutation.isPending}>
                  {saveServiceMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {editingService ? "Actualizar" : "Crear"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Dialog: Nuevo/Editar Centro de Coste */}
        <Dialog open={costCentreDialogOpen} onOpenChange={setCostCentreDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingCostCentre ? "Editar Centro de Coste" : "Nuevo Centro de Coste"}
              </DialogTitle>
              <DialogDescription>
                Mapea un restaurante con su código de centro de coste en A3Nom
              </DialogDescription>
            </DialogHeader>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveCostCentreMutation.mutate(costCentreFormData);
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cost_centro_id">
                    Restaurante <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={costCentreFormData.centro_id}
                    onValueChange={(val) =>
                      setCostCentreFormData({ ...costCentreFormData, centro_id: val })
                    }
                  >
                    <SelectTrigger id="cost_centro_id">
                      <SelectValue placeholder="Seleccionar restaurante" />
                    </SelectTrigger>
                    <SelectContent>
                      {centres.map((centre) => (
                        <SelectItem key={centre.id} value={centre.id}>
                          {centre.nombre} ({centre.codigo})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="a3_centro_code">
                    Código Centro A3 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="a3_centro_code"
                    value={costCentreFormData.a3_centro_code}
                    onChange={(e) =>
                      setCostCentreFormData({
                        ...costCentreFormData,
                        a3_centro_code: e.target.value,
                      })
                    }
                    placeholder="Ej: CC001"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cost_descripcion">Descripción (opcional)</Label>
                <Input
                  id="cost_descripcion"
                  value={costCentreFormData.descripcion}
                  onChange={(e) =>
                    setCostCentreFormData({
                      ...costCentreFormData,
                      descripcion: e.target.value,
                    })
                  }
                  placeholder="Descripción del centro de coste"
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetCostCentreForm}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saveCostCentreMutation.isPending}>
                  {saveCostCentreMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {editingCostCentre ? "Actualizar" : "Crear"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Dialog: Asignar Franquiciado */}
        <Dialog open={franchiseeDialogOpen} onOpenChange={setFranchiseeDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Asignar Franquiciado</DialogTitle>
              <DialogDescription>
                Selecciona un usuario para asignarlo como gestor del restaurante
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Seleccionar Usuario</Label>
                <Select
                  onValueChange={(userId) => {
                    if (userId && selectedCentroForFranchisee) {
                      assignFranchiseeMutation.mutate({
                        userId,
                        centroCodigo: selectedCentroForFranchisee,
                      });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un usuario" />
                  </SelectTrigger>
                  <SelectContent>
                    {usersWithRoles
                      .filter(user => {
                        // Filter out users already assigned to this centro
                        const existingAssignment = user.roles.find(
                          r => r.role === "gestor" && r.centro === selectedCentroForFranchisee
                        );
                        return !existingAssignment;
                      })
                      .map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.nombre} {user.apellidos} ({user.email})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setFranchiseeDialogOpen(false);
                  setSelectedCentroForFranchisee("");
                }}
              >
                Cancelar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default Restaurantes;
