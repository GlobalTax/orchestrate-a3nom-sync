import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Building2, CheckCircle2 } from "lucide-react";

interface InviteData {
  id: string;
  email: string;
  role: string;
  centro?: string;
  franchisee_id?: string;
  expires_at: string;
}

const AcceptInvite = () => {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [nombre, setNombre] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      toast.error("Token de invitación inválido");
      navigate("/auth");
      return;
    }

    validateToken(token);
  }, [searchParams, navigate]);

  const validateToken = async (token: string) => {
    try {
      const { data: invite, error } = await supabase
        .from("invites" as any)
        .select("*")
        .eq("token", token)
        .is("accepted_at", null)
        .gt("expires_at", new Date().toISOString())
        .single();

      if (error || !invite) {
        throw new Error("Token inválido o expirado");
      }

      setInviteData(invite as any);
      setLoading(false);
    } catch (error: any) {
      toast.error(error.message);
      navigate("/auth");
    }
  };

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password || password.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }

    if (!nombre || !apellidos) {
      toast.error("Por favor completa tu nombre y apellidos");
      return;
    }

    setSubmitting(true);

    try {
      // Create user in Supabase Auth
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: inviteData!.email,
        password,
        options: {
          data: {
            nombre,
            apellidos,
          }
        }
      });

      if (signUpError) throw signUpError;

      if (!authData.user) {
        throw new Error("Error al crear usuario");
      }

      // Assign role in user_roles
      const { error: roleError } = await supabase.from("user_roles" as any).insert({
        user_id: authData.user.id,
        role: inviteData!.role,
        centro: inviteData!.centro || null,
        franchisee_id: inviteData!.franchisee_id || null,
      } as any);

      if (roleError) throw roleError;

      // Mark invitation as accepted
      await supabase
        .from("invites" as any)
        .update({ accepted_at: new Date().toISOString() } as any)
        .eq("id", inviteData!.id);

      toast.success("¡Cuenta creada correctamente!");
      navigate("/dashboard");
    } catch (error: any) {
      console.error("Error al crear cuenta:", error);
      toast.error("Error al crear cuenta: " + error.message);
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="h-6 w-6 text-primary" />
            <CardTitle className="text-2xl">Crear tu cuenta</CardTitle>
          </div>
          <CardDescription>
            Has sido invitado a unirte al sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAccept} className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={inviteData?.email || ""}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label>Rol asignado</Label>
              <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span className="font-medium capitalize">{inviteData?.role}</span>
              </div>
            </div>

            {inviteData?.centro && (
              <div className="space-y-2">
                <Label>Centro asignado</Label>
                <Input
                  value={inviteData.centro}
                  disabled
                  className="bg-muted"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre *</Label>
              <Input
                id="nombre"
                type="text"
                placeholder="Tu nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="apellidos">Apellidos *</Label>
              <Input
                id="apellidos"
                type="text"
                placeholder="Tus apellidos"
                value={apellidos}
                onChange={(e) => setApellidos(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña *</Label>
              <Input
                id="password"
                type="password"
                placeholder="Mínimo 8 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar contraseña *</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Repite tu contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creando cuenta...
                </>
              ) : (
                "Crear cuenta y aceptar invitación"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AcceptInvite;
