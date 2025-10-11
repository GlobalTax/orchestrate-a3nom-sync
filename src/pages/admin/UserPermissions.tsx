import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Shield, UserPlus, Trash2, Search, Loader2, Building2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface UserProfile {
  id: string;
  email: string;
  nombre: string | null;
  apellidos: string | null;
}

interface UserRole {
  id: string;
  user_id: string;
  role: "admin" | "gestor";
  centro: string | null;
}

interface Restaurant {
  id: string;
  codigo: string;
  nombre: string;
}

interface UserWithRoles extends UserProfile {
  roles: UserRole[];
}

const UserPermissions = () => {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [selectedRole, setSelectedRole] = useState<"admin" | "gestor">("gestor");
  const [selectedRestaurants, setSelectedRestaurants] = useState<string[]>([]);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
      fetchRestaurants();
    }
  }, [isAdmin]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      // Fetch all users from auth.users via profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, nombre, apellidos")
        .order("email", { ascending: true });

      if (profilesError) throw profilesError;

      // Fetch all user roles
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("*");

      if (rolesError) throw rolesError;

      // Combine data
      const usersWithRoles: UserWithRoles[] = (profilesData || []).map(profile => ({
        ...profile,
        roles: (rolesData || []).filter(role => role.user_id === profile.id)
      }));

      setUsers(usersWithRoles);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      toast.error("Error al cargar usuarios");
    } finally {
      setLoading(false);
    }
  };

  const fetchRestaurants = async () => {
    try {
      const { data, error } = await supabase
        .from("centres")
        .select("id, codigo, nombre")
        .eq("activo", true)
        .order("codigo", { ascending: true });

      if (error) throw error;
      setRestaurants(data || []);
    } catch (error: any) {
      console.error("Error fetching restaurants:", error);
      toast.error("Error al cargar restaurantes");
    }
  };

  const handleOpenDialog = (user: UserWithRoles | null = null) => {
    setSelectedUser(user);
    
    if (user) {
      const hasAdmin = user.roles.some(r => r.role === "admin");
      setSelectedRole(hasAdmin ? "admin" : "gestor");
      setSelectedRestaurants(
        user.roles
          .filter(r => r.role === "gestor" && r.centro)
          .map(r => r.centro!)
      );
    } else {
      setSelectedRole("gestor");
      setSelectedRestaurants([]);
    }
    
    setIsDialogOpen(true);
  };

  const handleSavePermissions = async () => {
    if (!selectedUser) return;

    try {
      setLoading(true);

      // Delete all existing roles for this user
      const { error: deleteError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", selectedUser.id);

      if (deleteError) throw deleteError;

      // Insert new roles
      const rolesToInsert: any[] = [];

      if (selectedRole === "admin") {
        // Admin role (no restaurant assignment)
        rolesToInsert.push({
          user_id: selectedUser.id,
          role: "admin",
          centro: null
        });
      } else {
        // Gestor role with restaurant assignments
        selectedRestaurants.forEach(centroCode => {
          rolesToInsert.push({
            user_id: selectedUser.id,
            role: "gestor",
            centro: centroCode
          });
        });
      }

      if (rolesToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from("user_roles")
          .insert(rolesToInsert);

        if (insertError) throw insertError;
      }

      toast.success("Permisos actualizados correctamente");
      setIsDialogOpen(false);
      fetchUsers();
    } catch (error: any) {
      console.error("Error saving permissions:", error);
      toast.error("Error al guardar permisos");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!confirm("¿Estás seguro de eliminar este permiso?")) return;

    try {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("id", roleId);

      if (error) throw error;

      toast.success("Permiso eliminado correctamente");
      fetchUsers();
    } catch (error: any) {
      console.error("Error deleting role:", error);
      toast.error("Error al eliminar permiso");
    }
  };

  const toggleRestaurant = (codigo: string) => {
    setSelectedRestaurants(prev => 
      prev.includes(codigo)
        ? prev.filter(c => c !== codigo)
        : [...prev, codigo]
    );
  };

  const filteredUsers = users.filter(user => {
    const searchLower = searchTerm.toLowerCase();
    return (
      user.email?.toLowerCase().includes(searchLower) ||
      user.nombre?.toLowerCase().includes(searchLower) ||
      user.apellidos?.toLowerCase().includes(searchLower)
    );
  });

  if (roleLoading || !isAdmin) {
    return (
      <Layout>
        <div className="p-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Acceso Denegado</AlertTitle>
            <AlertDescription>
              Solo los administradores pueden acceder a esta página.
            </AlertDescription>
          </Alert>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Shield className="h-8 w-8" />
              Gestión de Permisos
            </h1>
            <p className="text-muted-foreground mt-1">
              Asigna roles y restaurantes a los usuarios
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Usuarios del Sistema</CardTitle>
            <CardDescription>
              Lista completa de usuarios con sus roles y permisos asignados
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por email o nombre..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuario</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Roles</TableHead>
                      <TableHead>Restaurantes</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          No se encontraron usuarios
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers.map((user) => {
                        const isAdmin = user.roles.some(r => r.role === "admin");
                        const gestorRoles = user.roles.filter(r => r.role === "gestor");
                        
                        return (
                          <TableRow key={user.id}>
                            <TableCell className="font-medium">
                              {user.nombre} {user.apellidos}
                            </TableCell>
                            <TableCell>{user.email}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {isAdmin && (
                                  <Badge variant="destructive">
                                    <Shield className="h-3 w-3 mr-1" />
                                    Admin
                                  </Badge>
                                )}
                                {gestorRoles.length > 0 && (
                                  <Badge variant="secondary">
                                    Gestor
                                  </Badge>
                                )}
                                {user.roles.length === 0 && (
                                  <Badge variant="outline">Sin roles</Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {isAdmin ? (
                                  <Badge variant="default" className="font-mono text-xs">
                                    TODOS
                                  </Badge>
                                ) : gestorRoles.length > 0 ? (
                                  gestorRoles.map((role) => (
                                    <Badge key={role.id} variant="outline" className="font-mono text-xs">
                                      {role.centro}
                                    </Badge>
                                  ))
                                ) : (
                                  <span className="text-muted-foreground text-sm">-</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenDialog(user)}
                              >
                                <Shield className="h-4 w-4 mr-1" />
                                Editar Permisos
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Editar Permisos de {selectedUser?.nombre} {selectedUser?.apellidos}
              </DialogTitle>
              <DialogDescription>
                Asigna un rol y selecciona los restaurantes a los que tendrá acceso
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <Label>Rol del Usuario</Label>
                <Select value={selectedRole} onValueChange={(val: any) => setSelectedRole(val)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        <span>Admin (acceso total)</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="gestor">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        <span>Gestor (restaurantes específicos)</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  {selectedRole === "admin" 
                    ? "Los administradores tienen acceso a todos los restaurantes y funciones de administración"
                    : "Los gestores solo pueden acceder a los restaurantes que se les asignen"}
                </p>
              </div>

              {selectedRole === "gestor" && (
                <div className="space-y-3">
                  <Label>Restaurantes Asignados</Label>
                  <div className="border rounded-md p-4 space-y-2 max-h-60 overflow-y-auto">
                    {restaurants.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No hay restaurantes disponibles
                      </p>
                    ) : (
                      restaurants.map((restaurant) => (
                        <div key={restaurant.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={restaurant.codigo}
                            checked={selectedRestaurants.includes(restaurant.codigo)}
                            onCheckedChange={() => toggleRestaurant(restaurant.codigo)}
                          />
                          <label
                            htmlFor={restaurant.codigo}
                            className="flex items-center gap-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            <Badge variant="outline" className="font-mono text-xs">
                              {restaurant.codigo}
                            </Badge>
                            <span>{restaurant.nombre}</span>
                          </label>
                        </div>
                      ))
                    )}
                  </div>
                  {selectedRestaurants.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      Seleccionados: {selectedRestaurants.length} restaurante(s)
                    </p>
                  )}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleSavePermissions}
                disabled={selectedRole === "gestor" && selectedRestaurants.length === 0}
              >
                <Shield className="h-4 w-4 mr-2" />
                Guardar Permisos
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default UserPermissions;
