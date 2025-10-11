import { ReactNode, useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import { RestaurantSelector } from "@/components/RestaurantSelector";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  DollarSign, 
  LogOut,
  Building2,
  Shield,
  FileSpreadsheet,
  AlertTriangle,
  History,
  Bell,
  Settings2,
  RefreshCw,
  Server,
  Activity
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";
import { useCentro } from "@/contexts/CentroContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import NotificationBell from "@/components/NotificationBell";

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [session, setSession] = useState<Session | null>(null);
  const { isAdmin } = useUserRole();
  const { selectedCentro, setSelectedCentro, availableCentros } = useCentro();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) {
        navigate("/auth");
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Sesión cerrada correctamente");
    navigate("/auth");
  };

  const menuItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
    { icon: Users, label: "Empleados", path: "/employees" },
    { icon: Calendar, label: "Calendario", path: "/calendar" },
    { icon: DollarSign, label: "Costes", path: "/costs" },
    { icon: AlertTriangle, label: "Calidad de Datos", path: "/calidad-datos" },
  ];

  const isActive = (path: string) => location.pathname === path;

  if (!session) return null;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <Sidebar className="border-r border-sidebar-border">
          <div className="p-6 border-b border-sidebar-border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-sidebar-primary rounded-lg">
                <Building2 className="h-6 w-6 text-sidebar-primary-foreground" />
              </div>
              <div>
                <h2 className="font-semibold text-sidebar-foreground">Orquest + A3Nom</h2>
                <p className="text-xs text-sidebar-foreground/60">Gestión Integrada</p>
              </div>
            </div>
          </div>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Menú Principal</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {menuItems.map((item) => (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton
                        onClick={() => navigate(item.path)}
                        isActive={isActive(item.path)}
                        className="w-full"
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {isAdmin && (
              <SidebarGroup>
                <SidebarGroupLabel>Administración</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        onClick={() => navigate("/admin/users")}
                        isActive={isActive("/admin/users")}
                        className="w-full"
                      >
                        <Shield className="h-4 w-4" />
                        <span>Administrar Usuarios</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        onClick={() => navigate("/admin/mapeo-empleados")}
                        isActive={isActive("/admin/mapeo-empleados")}
                        className="w-full"
                      >
                        <Users className="h-4 w-4" />
                        <span>Mapeo de IDs</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        onClick={() => navigate("/admin/importar-nominas")}
                        isActive={isActive("/admin/importar-nominas")}
                        className="w-full"
                      >
                        <FileSpreadsheet className="h-4 w-4" />
                        <span>Importar Nóminas</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        onClick={() => navigate("/admin/auditoria")}
                        isActive={isActive("/admin/auditoria")}
                        className="w-full"
                      >
                        <History className="h-4 w-4" />
                        <span>Auditoría</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        onClick={() => navigate("/admin/alertas")}
                        isActive={isActive("/admin/alertas")}
                        className="w-full"
                      >
                        <Bell className="h-4 w-4" />
                        <span>Alertas</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => navigate("/admin/restaurantes")}
                  isActive={isActive("/admin/restaurantes")}
                  className="w-full"
                >
                  <Building2 className="h-4 w-4" />
                  <span>Restaurantes</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        onClick={() => navigate("/admin/sincronizar")}
                        isActive={isActive("/admin/sincronizar")}
                        className="w-full"
                      >
                        <RefreshCw className="h-4 w-4" />
                        <span>Sincronización</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        onClick={() => navigate("/admin/health")}
                        isActive={isActive("/admin/health")}
                        className="w-full"
                      >
                        <Activity className="h-4 w-4" />
                        <span>Estado del Sistema</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        onClick={() => navigate("/admin/ajustes")}
                        isActive={isActive("/admin/ajustes")}
                        className="w-full"
                      >
                        <Settings2 className="h-4 w-4" />
                        <span>Ajustes</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}
          </SidebarContent>

          <div className="p-4 border-t border-sidebar-border mt-auto">
            <Button
              variant="ghost"
              className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar Sesión
            </Button>
          </div>
        </Sidebar>

        <div className="flex-1 flex flex-col">
          <header className="h-16 border-b border-border bg-card px-6 flex items-center justify-between">
            <SidebarTrigger />
            
            <div className="flex items-center gap-4">
              <RestaurantSelector />
              <NotificationBell />
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Layout;
