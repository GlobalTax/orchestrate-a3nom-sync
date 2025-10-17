import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InviteRequest {
  email: string;
  role: 'admin' | 'franquiciado' | 'gestor' | 'asesoria';
  centro?: string;
  franchisee_id?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get current user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No autorizado");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error("Usuario no autenticado");
    }

    // Check if user is admin
    const { data: adminCheck } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (!adminCheck) {
      throw new Error("Solo administradores pueden enviar invitaciones");
    }

    const body: InviteRequest = await req.json();
    const { email, role, centro, franchisee_id } = body;

    console.log(`📧 Procesando invitación para ${email} con rol ${role}`);

    // Validate data based on role
    if (role === 'asesoria' && !centro) {
      throw new Error('El rol "asesoría" requiere un centro asignado');
    }

    if (['franquiciado', 'gestor'].includes(role) && !franchisee_id) {
      throw new Error('Los roles "franquiciado" y "gestor" requieren un franchisee_id');
    }

    // Generate a random token (will be replaced with JWT when JWT_SECRET is set)
    const inviteToken = crypto.randomUUID();

    // Insert invitation in database
    const { data: invite, error: insertError } = await supabase
      .from('invites')
      .insert({
        email,
        token: inviteToken,
        role,
        centro: role === 'asesoria' ? centro : null,
        franchisee_id: ['franquiciado', 'gestor'].includes(role) ? franchisee_id : null,
        invited_by: user.id,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting invite:", insertError);
      throw insertError;
    }

    // TODO: Send email with Resend when RESEND_API_KEY is configured
    // For now, just return the invite token
    const appUrl = Deno.env.get("APP_URL") || "https://tuapp.lovable.app";
    const inviteLink = `${appUrl}/accept-invite?token=${inviteToken}`;

    console.log(`✅ Invitación creada para ${email}`);
    console.log(`🔗 Link de invitación: ${inviteLink}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Invitación creada correctamente",
        inviteLink, // Return link for now (until email is configured)
        invite
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("❌ Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" }, 
        status: error.message.includes("autorizado") ? 403 : 500 
      }
    );
  }
});
