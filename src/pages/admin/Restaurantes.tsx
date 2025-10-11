import { useState } from "react";
import { useUserRole } from "@/hooks/useUserRole";
import Layout from "@/components/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Building2, Plus, Info } from "lucide-react";

// Custom hooks
import { useRestaurants } from "@/features/restaurants/hooks/useRestaurants";
import { useFranchisees } from "@/features/restaurants/hooks/useFranchisees";
import { useServices } from "@/features/restaurants/hooks/useServices";
import { useCostCentres } from "@/features/restaurants/hooks/useCostCentres";
import { useGestores } from "@/features/restaurants/hooks/useGestores";

// Components
import { RestaurantsList } from "@/features/restaurants/components/RestaurantsList";
import { FranchiseesTab } from "@/features/restaurants/components/FranchiseesTab";
import { GestoresTab } from "@/features/restaurants/components/GestoresTab";
import { ServicesTab } from "@/features/restaurants/components/ServicesTab";
import { CostCentresTab } from "@/features/restaurants/components/CostCentresTab";

// Dialogs
import { RestaurantDialog } from "@/features/restaurants/components/dialogs/RestaurantDialog";
import { FranchiseeDialog } from "@/features/restaurants/components/dialogs/FranchiseeDialog";
import { ServiceDialog } from "@/features/restaurants/components/dialogs/ServiceDialog";
import { CostCentreDialog } from "@/features/restaurants/components/dialogs/CostCentreDialog";
import { AssignGestorDialog } from "@/features/restaurants/components/dialogs/AssignGestorDialog";

// Types
import type {
  RestaurantWithFranchisee,
  Franchisee,
  RestaurantService,
  CostCentre,
  RestaurantFormData,
  FranchiseeFormData,
  ServiceFormData,
  CostCentreFormData,
} from "@/features/restaurants/types";

const Restaurantes = () => {
  const { isAdmin, loading: roleLoading } = useUserRole();

  // State management
  const [activeTab, setActiveTab] = useState("general");
  const [testingCentre, setTestingCentre] = useState<string | null>(null);
  
  // Restaurant dialog state
  const [restaurantDialogOpen, setRestaurantDialogOpen] = useState(false);
  const [editingRestaurant, setEditingRestaurant] = useState<RestaurantWithFranchisee | null>(null);
  const [restaurantFormData, setRestaurantFormData] = useState<RestaurantFormData>({
    codigo: "",
    nombre: "",
    direccion: "",
    ciudad: "",
    pais: "España",
    postal_code: "",
    state: "",
    site_number: "",
    franchisee_id: null,
    seating_capacity: null,
    square_meters: null,
    opening_date: null,
    orquest_business_id: "",
    orquest_service_id: "",
  });

  // Franchisee dialog state
  const [franchiseeDialogOpen, setFranchiseeDialogOpen] = useState(false);
  const [editingFranchisee, setEditingFranchisee] = useState<Franchisee | null>(null);
  const [franchiseeFormData, setFranchiseeFormData] = useState<FranchiseeFormData>({
    email: "",
    name: "",
    company_tax_id: "",
  });

  // Service dialog state
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<RestaurantService | null>(null);
  const [serviceFormData, setServiceFormData] = useState<ServiceFormData>({
    centro_id: "",
    orquest_service_id: "",
    descripcion: "",
  });

  // Cost centre dialog state
  const [costCentreDialogOpen, setCostCentreDialogOpen] = useState(false);
  const [editingCostCentre, setEditingCostCentre] = useState<CostCentre | null>(null);
  const [costCentreFormData, setCostCentreFormData] = useState<CostCentreFormData>({
    centro_id: "",
    a3_centro_code: "",
    descripcion: "",
  });

  // Gestor dialog state
  const [gestorDialogOpen, setGestorDialogOpen] = useState(false);
  const [selectedCentroForGestor, setSelectedCentroForGestor] = useState("");

  // Custom hooks
  const {
    restaurants,
    isLoading: loadingRestaurants,
    error: restaurantsError,
    save: saveRestaurant,
    isSaving: isSavingRestaurant,
    toggleActive: toggleRestaurantActive,
    testConnection,
  } = useRestaurants(isAdmin);

  const {
    franchisees,
    isLoading: loadingFranchisees,
    save: saveFranchisee,
    isSaving: isSavingFranchisee,
    deleteFranchisee,
  } = useFranchisees(isAdmin);

  const {
    services,
    servicesCount,
    servicesByRestaurant,
    isLoading: loadingServices,
    save: saveService,
    isSaving: isSavingService,
    toggleActive: toggleServiceActive,
  } = useServices(isAdmin);

  const {
    costCentres,
    isLoading: loadingCostCentres,
    save: saveCostCentre,
    isSaving: isSavingCostCentre,
    toggleActive: toggleCostCentreActive,
  } = useCostCentres(isAdmin);

  const {
    usersWithRoles,
    gestoresByCentro,
    isLoading: loadingGestores,
    assignGestor,
    removeGestor,
    autoAssign,
  } = useGestores(isAdmin);

  // Restaurant handlers
  const handleEditRestaurant = (restaurant: RestaurantWithFranchisee) => {
    setEditingRestaurant(restaurant);
    setRestaurantFormData({
      codigo: restaurant.codigo,
      nombre: restaurant.nombre,
      direccion: restaurant.direccion || "",
      ciudad: restaurant.ciudad || "",
      pais: restaurant.pais,
      postal_code: restaurant.postal_code || "",
      state: restaurant.state || "",
      site_number: restaurant.site_number || "",
      franchisee_id: restaurant.franchisee_id,
      seating_capacity: restaurant.seating_capacity || null,
      square_meters: restaurant.square_meters || null,
      opening_date: restaurant.opening_date || null,
      orquest_business_id: restaurant.orquest_business_id || "",
      orquest_service_id: restaurant.orquest_service_id || "",
    });
    setRestaurantDialogOpen(true);
  };

  const handleSaveRestaurant = () => {
    saveRestaurant(
      { data: restaurantFormData, editingId: editingRestaurant?.id },
      {
        onSuccess: () => {
          setRestaurantDialogOpen(false);
          setEditingRestaurant(null);
          setRestaurantFormData({
            codigo: "",
            nombre: "",
            direccion: "",
            ciudad: "",
            pais: "España",
            postal_code: "",
            state: "",
            site_number: "",
            franchisee_id: null,
            seating_capacity: null,
            square_meters: null,
            opening_date: null,
            orquest_business_id: "",
            orquest_service_id: "",
          });
        },
      }
    );
  };

  const handleTestConnection = async (centreId: string) => {
    setTestingCentre(centreId);
    await testConnection(centreId);
    setTestingCentre(null);
  };

  // Franchisee handlers
  const handleEditFranchisee = (franchisee: Franchisee) => {
    setEditingFranchisee(franchisee);
    setFranchiseeFormData({
      email: franchisee.email,
      name: franchisee.name,
      company_tax_id: franchisee.company_tax_id || "",
    });
    setFranchiseeDialogOpen(true);
  };

  const handleSaveFranchisee = () => {
    saveFranchisee(
      { data: franchiseeFormData, editingId: editingFranchisee?.id },
      {
        onSuccess: () => {
          setFranchiseeDialogOpen(false);
          setEditingFranchisee(null);
          setFranchiseeFormData({ email: "", name: "", company_tax_id: "" });
        },
      }
    );
  };

  // Service handlers
  const handleEditService = (service: RestaurantService) => {
    setEditingService(service);
    setServiceFormData({
      centro_id: service.centro_id,
      orquest_service_id: service.orquest_service_id,
      descripcion: service.descripcion || "",
    });
    setServiceDialogOpen(true);
  };

  const handleSaveService = () => {
    saveService(
      { data: serviceFormData, editingId: editingService?.id },
      {
        onSuccess: () => {
          setServiceDialogOpen(false);
          setEditingService(null);
          setServiceFormData({ centro_id: "", orquest_service_id: "", descripcion: "" });
        },
      }
    );
  };

  // Cost centre handlers
  const handleEditCostCentre = (costCentre: CostCentre) => {
    setEditingCostCentre(costCentre);
    setCostCentreFormData({
      centro_id: costCentre.centro_id,
      a3_centro_code: costCentre.a3_centro_code,
      descripcion: costCentre.descripcion || "",
    });
    setCostCentreDialogOpen(true);
  };

  const handleSaveCostCentre = () => {
    saveCostCentre(
      { data: costCentreFormData, editingId: editingCostCentre?.id },
      {
        onSuccess: () => {
          setCostCentreDialogOpen(false);
          setEditingCostCentre(null);
          setCostCentreFormData({ centro_id: "", a3_centro_code: "", descripcion: "" });
        },
      }
    );
  };

  // Gestor handlers
  const handleAssignGestor = (centroCodigo: string) => {
    setSelectedCentroForGestor(centroCodigo);
    setGestorDialogOpen(true);
  };

  const handleGestorAssignment = (userId: string, centroCodigo: string) => {
    assignGestor(
      { userId, centroCodigo },
      {
        onSuccess: () => {
          setGestorDialogOpen(false);
          setSelectedCentroForGestor("");
        },
      }
    );
  };

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

        {/* Diagnostic Info (Dev Mode) */}
        {process.env.NODE_ENV === 'development' && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Diagnóstico del Sistema</AlertTitle>
            <AlertDescription className="space-y-1">
              <div>✅ Restaurantes: {restaurants.length} cargados</div>
              <div>✅ Franquiciados: {franchisees.length}</div>
              <div>✅ Services: {Object.keys(servicesCount).length} restaurantes con services</div>
              {restaurantsError && <div className="text-destructive">❌ Error: {(restaurantsError as any).message}</div>}
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="general">Datos Generales</TabsTrigger>
            <TabsTrigger value="franchisees-data">Franquiciados</TabsTrigger>
            <TabsTrigger value="franchisees">Gestores (Acceso Sistema)</TabsTrigger>
            <TabsTrigger value="services">Services Orquest</TabsTrigger>
            <TabsTrigger value="cost-centres">Centros de Coste A3</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-6">
            <div className="flex justify-end">
              <Button onClick={() => setRestaurantDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo Restaurante
              </Button>
            </div>

            <RestaurantsList
              restaurants={restaurants}
              servicesCount={servicesCount}
              isLoading={loadingRestaurants}
              testingCentre={testingCentre}
              onEdit={handleEditRestaurant}
              onToggleActive={toggleRestaurantActive}
              onTestConnection={handleTestConnection}
              onNavigateToServices={() => setActiveTab("services")}
            />
          </TabsContent>

          <TabsContent value="franchisees-data">
            <FranchiseesTab
              franchisees={franchisees}
              restaurants={restaurants}
              isLoading={loadingFranchisees}
              onEdit={handleEditFranchisee}
              onDelete={deleteFranchisee}
              onNew={() => setFranchiseeDialogOpen(true)}
            />
          </TabsContent>

          <TabsContent value="franchisees">
            <GestoresTab
              restaurants={restaurants}
              gestoresByCentro={gestoresByCentro}
              isLoading={loadingGestores || loadingRestaurants}
              onAssign={handleAssignGestor}
              onRemove={removeGestor}
              onAutoAssign={autoAssign}
              onImportCSV={() => window.location.href = '/admin/import-restaurants'}
            />
          </TabsContent>

          <TabsContent value="services">
            <ServicesTab
              servicesByRestaurant={servicesByRestaurant}
              isLoading={loadingServices}
              onEdit={handleEditService}
              onToggleActive={toggleServiceActive}
              onNew={() => setServiceDialogOpen(true)}
            />
          </TabsContent>

          <TabsContent value="cost-centres">
            <CostCentresTab
              costCentres={costCentres}
              isLoading={loadingCostCentres}
              onEdit={handleEditCostCentre}
              onToggleActive={toggleCostCentreActive}
              onNew={() => setCostCentreDialogOpen(true)}
            />
          </TabsContent>
        </Tabs>

        {/* Dialogs */}
        <RestaurantDialog
          open={restaurantDialogOpen}
          onOpenChange={setRestaurantDialogOpen}
          formData={restaurantFormData}
          onFormDataChange={setRestaurantFormData}
          franchisees={franchisees}
          isEditing={!!editingRestaurant}
          isSaving={isSavingRestaurant}
          onSubmit={handleSaveRestaurant}
        />

        <FranchiseeDialog
          open={franchiseeDialogOpen}
          onOpenChange={setFranchiseeDialogOpen}
          formData={franchiseeFormData}
          onFormDataChange={setFranchiseeFormData}
          isEditing={!!editingFranchisee}
          isSaving={isSavingFranchisee}
          onSubmit={handleSaveFranchisee}
        />

        <ServiceDialog
          open={serviceDialogOpen}
          onOpenChange={setServiceDialogOpen}
          formData={serviceFormData}
          onFormDataChange={setServiceFormData}
          restaurants={restaurants}
          isEditing={!!editingService}
          isSaving={isSavingService}
          onSubmit={handleSaveService}
        />

        <CostCentreDialog
          open={costCentreDialogOpen}
          onOpenChange={setCostCentreDialogOpen}
          formData={costCentreFormData}
          onFormDataChange={setCostCentreFormData}
          restaurants={restaurants}
          isEditing={!!editingCostCentre}
          isSaving={isSavingCostCentre}
          onSubmit={handleSaveCostCentre}
        />

        <AssignGestorDialog
          open={gestorDialogOpen}
          onOpenChange={setGestorDialogOpen}
          users={usersWithRoles}
          selectedCentro={selectedCentroForGestor}
          onAssign={handleGestorAssignment}
        />
      </div>
    </Layout>
  );
};

export default Restaurantes;
