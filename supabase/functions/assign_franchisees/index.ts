import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FranchiseeData {
  email: string;
  name: string;
  restaurants: Array<{
    id: string;
    codigo: string;
    nombre: string;
    ciudad: string;
  }>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

    console.log("🚀 Iniciando asignación de franquiciados...");

    // 1. Obtener todos los restaurantes con franquiciado asignado
    const { data: centres, error: centresError } = await supabaseClient
      .from("centres")
      .select("id, codigo, nombre, ciudad, franchisee_email, franchisee_name")
      .not("franchisee_email", "is", null)
      .eq("activo", true);

    if (centresError) {
      throw centresError;
    }

    console.log(`📊 Encontrados ${centres?.length || 0} restaurantes con franquiciado`);

    // 2. Agrupar restaurantes por email de franquiciado
    const franchiseeMap = new Map<string, FranchiseeData>();

    centres?.forEach((centre) => {
      const email = centre.franchisee_email!.toLowerCase().trim();
      
      if (!franchiseeMap.has(email)) {
        franchiseeMap.set(email, {
          email,
          name: centre.franchisee_name || email.split("@")[0],
          restaurants: [],
        });
      }

      franchiseeMap.get(email)!.restaurants.push({
        id: centre.id,
        codigo: centre.codigo,
        nombre: centre.nombre,
        ciudad: centre.ciudad || "",
      });
    });

    console.log(`👥 Encontrados ${franchiseeMap.size} franquiciados únicos`);

    const results = {
      total_franchisees: franchiseeMap.size,
      created_users: 0,
      existing_users: 0,
      roles_assigned: 0,
      errors: [] as string[],
    };

    // 3. Procesar cada franquiciado
    for (const [email, franchiseeData] of franchiseeMap.entries()) {
      try {
        console.log(`\n🔍 Procesando: ${email}`);

        // Verificar si el usuario ya existe
        const { data: existingUser } = await supabaseClient.auth.admin.listUsers();
        
        const userExists = existingUser?.users?.find(
          (u) => u.email?.toLowerCase() === email
        );

        let userId: string;

        if (userExists) {
          userId = userExists.id;
          results.existing_users++;
          console.log(`  ✓ Usuario ya existe: ${userId}`);
        } else {
          // Crear nuevo usuario
          const tempPassword = generatePassword();
          
          const { data: newUser, error: createError } = await supabaseClient.auth.admin.createUser({
            email: email,
            password: tempPassword,
            email_confirm: true,
            user_metadata: {
              nombre: franchiseeData.name,
              role: "gestor",
            },
          });

          if (createError) {
            throw createError;
          }

          userId = newUser.user!.id;
          results.created_users++;
          console.log(`  ✓ Usuario creado: ${userId}`);

          // Enviar email de bienvenida
          try {
            const restaurantList = franchiseeData.restaurants
              .map((r) => `- ${r.nombre} (${r.ciudad}) - Código: ${r.codigo}`)
              .join("\n");

            await resend.emails.send({
              from: "McDonald's España <onboarding@resend.dev>",
              to: [email],
              subject: "Bienvenido al Sistema de Gestión de McDonald's",
              html: `
                <h1>Bienvenido al Sistema de Gestión</h1>
                <p>Hola ${franchiseeData.name},</p>
                <p>Se te ha asignado acceso al sistema de gestión de McDonald's España.</p>
                
                <h2>Tus Restaurantes Asignados:</h2>
                <pre>${restaurantList}</pre>
                
                <h3>Credenciales de Acceso:</h3>
                <p><strong>Usuario:</strong> ${email}</p>
                <p><strong>Contraseña temporal:</strong> ${tempPassword}</p>
                
                <p><strong>⚠️ IMPORTANTE:</strong> Por favor, cambia tu contraseña al iniciar sesión por primera vez.</p>
                
                <p>Puedes acceder al sistema en: ${Deno.env.get("SUPABASE_URL")?.replace(".supabase.co", ".lovable.app") || "tu-app.lovable.app"}</p>
                
                <p>Saludos,<br>Equipo de McDonald's España</p>
              `,
            });

            console.log(`  ✉️ Email enviado a ${email}`);
          } catch (emailError) {
            console.error(`  ⚠️ Error enviando email a ${email}:`, emailError);
            results.errors.push(`Error enviando email a ${email}: ${emailError.message}`);
          }
        }

        // 4. Asignar roles para cada restaurante
        for (const restaurant of franchiseeData.restaurants) {
          try {
            // Verificar si ya existe el rol
            const { data: existingRole } = await supabaseClient
              .from("user_roles")
              .select("id")
              .eq("user_id", userId)
              .eq("role", "gestor")
              .eq("centro", restaurant.codigo)
              .maybeSingle();

            if (!existingRole) {
              const { error: roleError } = await supabaseClient
                .from("user_roles")
                .insert({
                  user_id: userId,
                  role: "gestor",
                  centro: restaurant.codigo,
                });

              if (roleError && roleError.code !== "23505") {
                // Ignorar duplicados
                throw roleError;
              }

              results.roles_assigned++;
              console.log(`  ✓ Rol asignado para restaurante: ${restaurant.codigo}`);
            } else {
              console.log(`  ⊙ Rol ya existía para: ${restaurant.codigo}`);
            }
          } catch (roleError: any) {
            console.error(`  ✗ Error asignando rol:`, roleError);
            results.errors.push(
              `Error asignando rol a ${email} para ${restaurant.codigo}: ${roleError.message}`
            );
          }
        }

        console.log(`  ✅ Completado para ${email}`);
      } catch (error: any) {
        console.error(`❌ Error procesando ${email}:`, error);
        results.errors.push(`Error procesando ${email}: ${error.message}`);
      }
    }

    console.log("\n✅ Proceso completado");
    console.log("📊 Resultados:", results);

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("❌ Error general:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

function generatePassword(): string {
  const length = 16;
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}
