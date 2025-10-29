import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CentroProvider } from "@/contexts/CentroContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ForgotPassword from "./pages/ForgotPassword";
import Dashboard from "./pages/Dashboard";
import Employees from "./pages/Employees";
import EmployeeDetail from "./pages/EmployeeDetail";
import Calendar from "./pages/Calendar";
import Costs from "./pages/Costs";
import Users from "./pages/admin/Users";
import EmployeeMapping from "./pages/admin/EmployeeMapping";
import PayrollImport from "./pages/admin/PayrollImport";
import RestaurantImport from "./pages/admin/RestaurantImport";
import RestaurantAutoImport from "./pages/admin/RestaurantAutoImport";
import Audit from "./pages/admin/Audit";
import Alerts from "./pages/admin/Alerts";
import Centres from "./pages/admin/Centres";
import CostCentres from "./pages/admin/CostCentres";
import Services from "./pages/admin/Services";
import Restaurantes from "./pages/admin/Restaurantes";
import Settings from "./pages/admin/Settings";
import Sync from "./pages/admin/Sync";
import OrquestSync from "./pages/admin/OrquestSync";
import Health from "./pages/admin/Health";
import DataQuality from "./pages/DataQuality";
import Notifications from "./pages/Notifications";
import AcceptInvite from "./pages/AcceptInvite";
import NotFound from "./pages/NotFound";
import { useUserTheme } from "./hooks/useUserTheme";
import { RestaurantProvider } from "./contexts/RestaurantContext";
import Layout from "./components/Layout";

const queryClient = new QueryClient();

const App = () => {
  useUserTheme(); // Load user theme on app start

  return (
    <QueryClientProvider client={queryClient}>
      <RestaurantProvider>
        <CentroProvider>
          <TooltipProvider>
            <BrowserRouter>
              <Toaster />
              <Sonner />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/accept-invite" element={<AcceptInvite />} />
            
            {/* Protected routes with persistent Layout */}
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
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </CentroProvider>
    </RestaurantProvider>
  </QueryClientProvider>
);
};

export default App;
