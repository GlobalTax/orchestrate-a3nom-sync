import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Shield, UserCog, Search } from "lucide-react";

interface UserWithRoles {
  id: string;
  email: string;
  nombre: string;
  apellidos: string;
  roles: string[];
  centro?: string;
}

const Users = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [newRole, setNewRole] = useState<string>("");
  const [newCentro, setNewCentro] = useState<string>("");

  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      toast.error("No tienes permisos para acceder a esta página");
      navigate("/dashboard");
    }
  }, [isAdmin, roleLoading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("email");

      if (profilesError) throw profilesError;

      // Fetch user roles
      const { data: userRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("*");

      if (rolesError) throw rolesError;

      // Combine data
      const usersWithRoles: UserWithRoles[] = (profiles || []).map(profile => {
        const roles = userRoles?.filter(ur => ur.user_id === profile.id) || [];
        return {
          id: profile.id,
          email: profile.email || "",
          nombre: profile.nombre || "",
          apellidos: profile.apellidos || "",
          roles: roles.map(r => r.role),
          centro: roles.find(r => r.centro)?.centro,
        };
      });

      setUsers(usersWithRoles);
    } catch (error: any) {
      toast.error("Error al cargar usuarios: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRole = async (userId: string, role: string, centro?: string) => {
    try {
      // Check if role already exists
      const { data: existingRole } = await supabase
        .from("user_roles")
        .select("*")
        .eq("user_id", userId)
        .eq("role", role)
        .single();

      if (existingRole) {
        // Update existing role with centro if provided
        if (centro) {
          const { error } = await supabase
            .from("user_roles")
            .update({ centro })
            .eq("id", existingRole.id);
          
          if (error) throw error;
        }
      } else {
        // Insert new role
        const { error } = await supabase
          .from("user_roles")
          .insert({
            user_id: userId,
            role: role as "admin" | "gestor",
            centro: role === "gestor" ? centro : null,
          });

        if (error) throw error;
      }

      toast.success("Rol actualizado correctamente");
      fetchUsers();
      setSelectedUser(null);
      setNewRole("");
      setNewCentro("");
    } catch (error: any) {
      toast.error("Error al actualizar rol: " + error.message);
    }
  };

  const handleRemoveRole = async (userId: string, role: string) => {
    try {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", role);

      if (error) throw error;

      toast.success("Rol eliminado correctamente");
      fetchUsers();
    } catch (error: any) {
      toast.error("Error al eliminar rol: " + error.message);
    }
  };

  const filteredUsers = users.filter(user =>
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.apellidos.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (roleLoading || !isAdmin) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Administrar Usuarios</h1>
          <p className="text-muted-foreground">
            Gestiona los roles y permisos de los usuarios del sistema
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Buscar Usuarios</CardTitle>
            <CardDescription>
              Encuentra usuarios por email, nombre o apellidos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por email, nombre o apellidos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Lista de Usuarios</CardTitle>
            <CardDescription>
              {filteredUsers.length} usuario{filteredUsers.length !== 1 ? "s" : ""} encontrado{filteredUsers.length !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead>Centro</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{user.nombre} {user.apellidos}</div>
                        </div>
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {user.roles.length > 0 ? (
                            user.roles.map((role) => (
                              <Badge
                                key={role}
                                variant={role === "admin" ? "default" : "secondary"}
                                className="cursor-pointer"
                                onClick={() => handleRemoveRole(user.id, role)}
                              >
                                {role === "admin" ? (
                                  <Shield className="h-3 w-3 mr-1" />
                                ) : (
                                  <UserCog className="h-3 w-3 mr-1" />
                                )}
                                {role}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-sm text-muted-foreground">Sin roles</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.centro ? (
                          <Badge variant="outline">{user.centro}</Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {selectedUser === user.id ? (
                          <div className="space-y-2">
                            <Select value={newRole} onValueChange={setNewRole}>
                              <SelectTrigger className="w-32">
                                <SelectValue placeholder="Rol" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="gestor">Gestor</SelectItem>
                              </SelectContent>
                            </Select>
                            {newRole === "gestor" && (
                              <Input
                                placeholder="Centro"
                                value={newCentro}
                                onChange={(e) => setNewCentro(e.target.value)}
                                className="w-32"
                              />
                            )}
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                onClick={() => handleUpdateRole(user.id, newRole, newCentro)}
                                disabled={!newRole}
                              >
                                Guardar
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedUser(null);
                                  setNewRole("");
                                  setNewCentro("");
                                }}
                              >
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedUser(user.id)}
                          >
                            Añadir Rol
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Users;
