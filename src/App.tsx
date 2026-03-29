import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CentroProvider } from "@/contexts/CentroContext";
import { useUserTheme } from "./hooks/useUserTheme";
import { RestaurantProvider } from "./contexts/RestaurantContext";
import { AuthReadyProvider } from "./hooks/useAuthReady";
import Layout from "./components/Layout";

const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Employees = lazy(() => import("./pages/Employees"));
const EmployeeDetail = lazy(() => import("./pages/EmployeeDetail"));
const Calendar = lazy(() => import("./pages/Calendar"));
const Costs = lazy(() => import("./pages/Costs"));
const Users = lazy(() => import("./pages/admin/Users"));
const EmployeeMapping = lazy(() => import("./pages/admin/EmployeeMapping"));
const PayrollImport = lazy(() => import("./pages/admin/PayrollImport"));
const RestaurantImport = lazy(() => import("./pages/admin/RestaurantImport"));
const RestaurantAutoImport = lazy(() => import("./pages/admin/RestaurantAutoImport"));
const Audit = lazy(() => import("./pages/admin/Audit"));
const Alerts = lazy(() => import("./pages/admin/Alerts"));
const Centres = lazy(() => import("./pages/admin/Centres"));
const CostCentres = lazy(() => import("./pages/admin/CostCentres"));
const Services = lazy(() => import("./pages/admin/Services"));
const Restaurantes = lazy(() => import("./pages/admin/Restaurantes"));
const Settings = lazy(() => import("./pages/admin/Settings"));
const Sync = lazy(() => import("./pages/admin/Sync"));
const OrquestSync = lazy(() => import("./pages/admin/OrquestSync"));
const Health = lazy(() => import("./pages/admin/Health"));
const DataQuality = lazy(() => import("./pages/DataQuality"));
const Notifications = lazy(() => import("./pages/Notifications"));
const AcceptInvite = lazy(() => import("./pages/AcceptInvite"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const AppInner = () => {
  useUserTheme();

  return (
    <BrowserRouter>
      <Toaster />
      <Sonner />
      <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>}>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/accept-invite" element={<AcceptInvite />} />

          <Route element={<Layout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/employees" element={<Employees />} />
            <Route path="/employees/:id" element={<EmployeeDetail />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/costs" element={<Costs />} />
            <Route path="/calidad-datos" element={<DataQuality />} />
            <Route path="/admin/users" element={<Users />} />
            <Route path="/admin/mapeo-empleados" element={<EmployeeMapping />} />
            <Route path="/admin/importar-nominas" element={<PayrollImport />} />
            <Route path="/admin/auditoria" element={<Audit />} />
            <Route path="/admin/alertas" element={<Alerts />} />
            <Route path="/admin/import-restaurants" element={<RestaurantImport />} />
            <Route path="/admin/restaurant-auto-import" element={<RestaurantAutoImport />} />
            <Route path="/admin/restaurantes" element={<Restaurantes />} />
            <Route path="/admin/centres" element={<Centres />} />
            <Route path="/admin/centros" element={<Centres />} />
            <Route path="/admin/centros-coste" element={<CostCentres />} />
            <Route path="/admin/services" element={<Services />} />
            <Route path="/admin/ajustes" element={<Settings />} />
            <Route path="/admin/sincronizar" element={<Sync />} />
            <Route path="/admin/sincronizacion-orquest" element={<OrquestSync />} />
            <Route path="/admin/health" element={<Health />} />
            <Route path="/notificaciones" element={<Notifications />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

const App = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthReadyProvider>
          <RestaurantProvider>
            <CentroProvider>
              <TooltipProvider>
                <AppInner />
              </TooltipProvider>
            </CentroProvider>
          </RestaurantProvider>
        </AuthReadyProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
