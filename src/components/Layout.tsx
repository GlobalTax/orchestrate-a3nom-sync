import { useEffect, useState } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import { useIsMobile } from "@/hooks/use-mobile";
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
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";
import NotificationBell from "@/components/NotificationBell";
import { RestaurantSelector } from "@/components/RestaurantSelector";

const Layout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [session, setSession] = useState<Session | null>(null);
  const { isAdmin } = useUserRole();
  const isMobile = useIsMobile();
  const [everAdmin, setEverAdmin] = useState(false);

  useEffect(() => {
    if (isAdmin) setEverAdmin(true);
  }, [isAdmin]);

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
    <SidebarProvider open={true}>
      <div className="min-h-screen flex w-full">
        <Sidebar collapsible="none" className="w-60 border-r border-sidebar-border/50">
          <div className="p-4 border-b border-sidebar-border/50">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-sidebar-primary/10 rounded-md">
                <Building2 className="h-4 w-4 text-sidebar-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-sidebar-foreground">Orquest</h2>
                <p className="text-[10px] text-sidebar-foreground/60">Gestión Integrada</p>
              </div>
            </div>
          </div>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel className="text-[11px] uppercase tracking-wider font-medium text-sidebar-foreground/50">Menú Principal</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                   {menuItems.map((item) => (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton
                        onClick={() => navigate(item.path)}
                        isActive={isActive(item.path)}
                        tooltip={item.label}
                        className={`h-8 px-3 text-[13px] transition-all duration-150 ease-linear-ease ${
                          isActive(item.path) 
                            ? "bg-primary/8 text-primary font-medium" 
                            : "text-sidebar-foreground/70 font-normal hover:bg-sidebar-accent hover:text-sidebar-foreground"
                        }`}
                      >
                        <item.icon className="h-4 w-4 mr-2" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {(isAdmin || everAdmin) && (
              <SidebarGroup>
                <SidebarGroupLabel className="text-[11px] uppercase tracking-wider font-medium text-sidebar-foreground/50">Administración</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        onClick={() => navigate("/admin/users")}
                        isActive={isActive("/admin/users")}
                        tooltip="Administrar Usuarios"
                        className={`h-8 px-3 text-[13px] transition-all duration-150 ease-linear-ease ${
                          isActive("/admin/users") 
                            ? "bg-primary/8 text-primary font-medium" 
                            : "text-sidebar-foreground/70 font-normal hover:bg-sidebar-accent hover:text-sidebar-foreground"
                        }`}
                      >
                        <Shield className="h-4 w-4 mr-2" />
                        <span>Administrar Usuarios</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        onClick={() => navigate("/admin/mapeo-empleados")}
                        isActive={isActive("/admin/mapeo-empleados")}
                        tooltip="Mapeo de IDs"
                        className={`h-8 px-3 text-[13px] transition-all duration-150 ease-linear-ease ${
                          isActive("/admin/mapeo-empleados") 
                            ? "bg-primary/8 text-primary font-medium" 
                            : "text-sidebar-foreground/70 font-normal hover:bg-sidebar-accent hover:text-sidebar-foreground"
                        }`}
                      >
                        <Users className="h-4 w-4 mr-2" />
                        <span>Mapeo de IDs</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        onClick={() => navigate("/admin/importar-nominas")}
                        isActive={isActive("/admin/importar-nominas")}
                        tooltip="Importar Nóminas"
                        className={`h-8 px-3 text-[13px] transition-all duration-150 ease-linear-ease ${
                          isActive("/admin/importar-nominas") 
                            ? "bg-primary/8 text-primary font-medium" 
                            : "text-sidebar-foreground/70 font-normal hover:bg-sidebar-accent hover:text-sidebar-foreground"
                        }`}
                      >
                        <FileSpreadsheet className="h-4 w-4 mr-2" />
                        <span>Importar Nóminas</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        onClick={() => navigate("/admin/auditoria")}
                        isActive={isActive("/admin/auditoria")}
                        tooltip="Auditoría"
                        className={`h-8 px-3 text-[13px] transition-all duration-150 ease-linear-ease ${
                          isActive("/admin/auditoria") 
                            ? "bg-primary/8 text-primary font-medium" 
                            : "text-sidebar-foreground/70 font-normal hover:bg-sidebar-accent hover:text-sidebar-foreground"
                        }`}
                      >
                        <History className="h-4 w-4 mr-2" />
                        <span>Auditoría</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        onClick={() => navigate("/admin/alertas")}
                        isActive={isActive("/admin/alertas")}
                        tooltip="Alertas"
                        className={`h-8 px-3 text-[13px] transition-all duration-150 ease-linear-ease ${
                          isActive("/admin/alertas") 
                            ? "bg-primary/8 text-primary font-medium" 
                            : "text-sidebar-foreground/70 font-normal hover:bg-sidebar-accent hover:text-sidebar-foreground"
                        }`}
                      >
                        <Bell className="h-4 w-4 mr-2" />
                        <span>Alertas</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => navigate("/admin/restaurantes")}
                  isActive={isActive("/admin/restaurantes")}
                  tooltip="Restaurantes"
                  className={`h-8 px-3 text-[13px] transition-all duration-150 ease-linear-ease ${
                    isActive("/admin/restaurantes") 
                      ? "bg-primary/8 text-primary font-medium" 
                      : "text-sidebar-foreground/70 font-normal hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  }`}
                >
                  <Building2 className="h-4 w-4 mr-2" />
                  <span>Restaurantes</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        onClick={() => navigate("/admin/sincronizacion-orquest")}
                        isActive={isActive("/admin/sincronizacion-orquest")}
                        tooltip="Sincronización Orquest"
                        className={`h-8 px-3 text-[13px] transition-all duration-150 ease-linear-ease ${
                          isActive("/admin/sincronizacion-orquest") 
                            ? "bg-primary/8 text-primary font-medium" 
                            : "text-sidebar-foreground/70 font-normal hover:bg-sidebar-accent hover:text-sidebar-foreground"
                        }`}
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        <span>Sync Orquest</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        onClick={() => navigate("/admin/sincronizar")}
                        isActive={isActive("/admin/sincronizar")}
                        tooltip="Sincronización Operativa"
                        className={`h-8 px-3 text-[13px] transition-all duration-150 ease-linear-ease ${
                          isActive("/admin/sincronizar") 
                            ? "bg-primary/8 text-primary font-medium" 
                            : "text-sidebar-foreground/70 font-normal hover:bg-sidebar-accent hover:text-sidebar-foreground"
                        }`}
                      >
                        <Server className="h-4 w-4 mr-2" />
                        <span>Sync Operativa</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        onClick={() => navigate("/admin/health")}
                        isActive={isActive("/admin/health")}
                        tooltip="Estado del Sistema"
                        className={`h-8 px-3 text-[13px] transition-all duration-150 ease-linear-ease ${
                          isActive("/admin/health") 
                            ? "bg-primary/8 text-primary font-medium" 
                            : "text-sidebar-foreground/70 font-normal hover:bg-sidebar-accent hover:text-sidebar-foreground"
                        }`}
                      >
                        <Activity className="h-4 w-4 mr-2" />
                        <span>Estado del Sistema</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        onClick={() => navigate("/admin/ajustes")}
                        isActive={isActive("/admin/ajustes")}
                        tooltip="Ajustes"
                        className={`h-8 px-3 text-[13px] transition-all duration-150 ease-linear-ease ${
                          isActive("/admin/ajustes") 
                            ? "bg-primary/8 text-primary font-medium" 
                            : "text-sidebar-foreground/70 font-normal hover:bg-sidebar-accent hover:text-sidebar-foreground"
                        }`}
                      >
                        <Settings2 className="h-4 w-4 mr-2" />
                        <span>Ajustes</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}
          </SidebarContent>

          <div className="p-3 border-t border-sidebar-border/50 mt-auto">
            <Button
              variant="ghost"
              className="w-full h-8 justify-start text-[13px] font-normal text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all duration-150 ease-linear-ease"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar Sesión
            </Button>
          </div>
        </Sidebar>

        <div className="flex-1 flex flex-col">
          <header className="h-12 border-b border-border/50 bg-background px-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-medium text-foreground">Gestión Integrada</h2>
            </div>
            
            <div className="flex items-center gap-2">
              <RestaurantSelector />
              <NotificationBell />
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Layout;
