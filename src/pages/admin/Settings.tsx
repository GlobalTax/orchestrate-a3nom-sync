import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Settings2, CheckCircle2, XCircle, Loader2, Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { supabase } from "@/integrations/supabase/client";
import { useUserTheme } from "@/hooks/useUserTheme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";


const orquestSchema = z.object({
  baseUrl: z.string().url({ message: "URL no válida" }).optional().or(z.literal('')),
  jsessionId: z.string().min(10, { message: "JSESSIONID debe tener al menos 10 caracteres" }).optional().or(z.literal('')),
  defaultServiceId: z.string().optional(),
  periodoPolitica: z.enum(['mes_natural', 'mes_comercial']),
});

const emailSchema = z.object({
  remitente_nombre: z.string().min(1, { message: "Nombre requerido" }),
  remitente_email: z.string().email({ message: "Email no válido" }),
});

type OrquestFormData = z.infer<typeof orquestSchema>;
type EmailFormData = z.infer<typeof emailSchema>;

export default function Settings() {
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [services, setServices] = useState<any[]>([]);
  const [savingOrquest, setSavingOrquest] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const { theme, setTheme } = useTheme();
  const { updateUserTheme } = useUserTheme();

  const orquestForm = useForm<OrquestFormData>({
    resolver: zodResolver(orquestSchema),
    defaultValues: {
      baseUrl: '',
      jsessionId: '',
      defaultServiceId: '',
      periodoPolitica: 'mes_natural',
    },
  });

  const emailForm = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      remitente_nombre: 'Orquest + A3Nom',
      remitente_email: '',
    },
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const { data, error } = await supabase
      .from('organization_settings')
      .select('*')
      .single();

    if (error) {
      console.error('Error loading settings:', error);
      return;
    }

    if (data) {
      orquestForm.reset({
        baseUrl: data.orquest_base_url || '',
        jsessionId: '', // Never load sensitive data
        defaultServiceId: data.orquest_default_service_id || '',
        periodoPolitica: (data.orquest_periodo_politica as 'mes_natural' | 'mes_comercial') || 'mes_natural',
      });

      emailForm.reset({
        remitente_nombre: data.email_remitente_nombre || 'Orquest + A3Nom',
        remitente_email: data.email_remitente_email || '',
      });
    }
  };

  const testConnection = async () => {
    const values = orquestForm.getValues();
    
    if (!values.baseUrl || !values.jsessionId) {
      toast.error('Debes completar Base URL y JSESSIONID');
      return;
    }

    setTestingConnection(true);
    setConnectionStatus('idle');

    try {
      const { data, error } = await supabase.functions.invoke('test_orquest_connection', {
        body: {
          baseUrl: values.baseUrl,
          jsessionId: values.jsessionId,
        },
      });

      if (error) throw error;

      if (data.success) {
        setConnectionStatus('success');
        setServices(data.services || []);
        toast.success(data.message);
      } else {
        setConnectionStatus('error');
        toast.error(data.message);
      }
    } catch (error: any) {
      setConnectionStatus('error');
      toast.error(`Error: ${error.message}`);
    } finally {
      setTestingConnection(false);
    }
  };

  const saveOrquestSettings = async (data: OrquestFormData) => {
    setSavingOrquest(true);

    try {
      const { error } = await supabase
        .from('organization_settings')
        .upsert({
          id: '00000000-0000-0000-0000-000000000001',
          orquest_base_url: data.baseUrl,
          orquest_default_service_id: data.defaultServiceId,
          orquest_periodo_politica: data.periodoPolitica,
        });

      if (error) throw error;

      if (data.jsessionId && data.jsessionId.length > 0) {
        toast.info(
          'Para actualizar el JSESSIONID, ve al Dashboard de Supabase > Edge Functions > Secrets',
          { duration: 8000 }
        );
      }

      toast.success('Configuración de Orquest guardada correctamente');
    } catch (error: any) {
      toast.error(`Error al guardar: ${error.message}`);
    } finally {
      setSavingOrquest(false);
    }
  };

  const saveEmailSettings = async (data: EmailFormData) => {
    setSavingEmail(true);

    try {
      const { error } = await supabase
        .from('organization_settings')
        .upsert({
          id: '00000000-0000-0000-0000-000000000001',
          email_remitente_nombre: data.remitente_nombre,
          email_remitente_email: data.remitente_email,
        });

      if (error) throw error;

      toast.success('Configuración de email guardada correctamente');
    } catch (error: any) {
      toast.error(`Error al guardar: ${error.message}`);
    } finally {
      setSavingEmail(false);
    }
  };

  const handleThemeChange = async (newTheme: 'light' | 'dark' | 'system') => {
    const { error } = await updateUserTheme(newTheme);
    if (error) {
      toast.error('Error al guardar preferencia de tema');
    } else {
      toast.success('Tema guardado correctamente');
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3 mb-6">
          <Settings2 className="h-8 w-8" />
          <div>
            <h1 className="text-3xl font-bold">Ajustes de Organización</h1>
            <p className="text-muted-foreground">Configura integraciones y preferencias</p>
          </div>
        </div>

        <Tabs defaultValue="orquest" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="orquest">🔌 Orquest</TabsTrigger>
            <TabsTrigger value="nominas">📊 Nóminas</TabsTrigger>
            <TabsTrigger value="email">✉️ Email</TabsTrigger>
            <TabsTrigger value="tema">🎨 Apariencia</TabsTrigger>
          </TabsList>

          {/* Orquest Tab */}
          <TabsContent value="orquest">
            <Card>
              <CardHeader>
                <CardTitle>Configuración de Orquest</CardTitle>
                <CardDescription>
                  Configura la conexión con la API de Orquest para sincronización de planificaciones
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={orquestForm.handleSubmit(saveOrquestSettings)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="baseUrl">Base URL de Orquest</Label>
                    <Input
                      id="baseUrl"
                      placeholder="https://api.orquest.com"
                      {...orquestForm.register('baseUrl')}
                    />
                    {orquestForm.formState.errors.baseUrl && (
                      <p className="text-sm text-destructive">{orquestForm.formState.errors.baseUrl.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="jsessionId">JSESSIONID</Label>
                    <Input
                      id="jsessionId"
                      type="password"
                      placeholder="••••••••••"
                      {...orquestForm.register('jsessionId')}
                    />
                    {orquestForm.formState.errors.jsessionId && (
                      <p className="text-sm text-destructive">{orquestForm.formState.errors.jsessionId.message}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      La cookie de sesión se almacena de forma segura en Supabase Secrets
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={testConnection}
                      disabled={testingConnection}
                    >
                      {testingConnection ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Probando...
                        </>
                      ) : connectionStatus === 'success' ? (
                        <>
                          <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
                          Conexión exitosa
                        </>
                      ) : connectionStatus === 'error' ? (
                        <>
                          <XCircle className="mr-2 h-4 w-4 text-destructive" />
                          Error de conexión
                        </>
                      ) : (
                        'Probar Conexión'
                      )}
                    </Button>
                  </div>

                  {services.length > 0 && (
                    <div className="space-y-2">
                      <Label htmlFor="defaultServiceId">Service ID por defecto</Label>
                      <Select
                        value={orquestForm.watch('defaultServiceId')}
                        onValueChange={(value) => orquestForm.setValue('defaultServiceId', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un servicio" />
                        </SelectTrigger>
                        <SelectContent>
                          {services.map((service: any) => (
                            <SelectItem key={service.id} value={service.id}>
                              {service.nombre || service.name || service.id}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Política de períodos</Label>
                    <RadioGroup
                      value={orquestForm.watch('periodoPolitica')}
                      onValueChange={(value) => orquestForm.setValue('periodoPolitica', value as 'mes_natural' | 'mes_comercial')}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="mes_natural" id="mes_natural" />
                        <Label htmlFor="mes_natural" className="font-normal">
                          Mes natural (1-31)
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="mes_comercial" id="mes_comercial" />
                        <Label htmlFor="mes_comercial" className="font-normal">
                          Mes comercial (26-25)
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <Button type="submit" disabled={savingOrquest}>
                    {savingOrquest ? 'Guardando...' : 'Guardar Configuración'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Nóminas Tab */}
          <TabsContent value="nominas">
            <Card>
              <CardHeader>
                <CardTitle>Configuración de Nóminas</CardTitle>
                <CardDescription>
                  Define el formato esperado para los archivos de nóminas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Formato esperado</Label>
                    <Select defaultValue="a3nom">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="a3nom">A3Nom</SelectItem>
                        <SelectItem value="personalizado">Personalizado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Columnas requeridas</Label>
                    <div className="text-sm text-muted-foreground">
                      <ul className="list-disc list-inside space-y-1">
                        <li>codtrabajador</li>
                        <li>periodo_inicio</li>
                        <li>periodo_fin</li>
                        <li>horas_trabajadas</li>
                      </ul>
                    </div>
                  </div>

                  <Button disabled>
                    Guardar Configuración
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Email Tab */}
          <TabsContent value="email">
            <Card>
              <CardHeader>
                <CardTitle>Configuración de Email</CardTitle>
                <CardDescription>
                  Configura el remitente para notificaciones por correo
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={emailForm.handleSubmit(saveEmailSettings)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="remitente_nombre">Nombre del remitente</Label>
                    <Input
                      id="remitente_nombre"
                      placeholder="Orquest + A3Nom"
                      {...emailForm.register('remitente_nombre')}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="remitente_email">Email del remitente</Label>
                    <Input
                      id="remitente_email"
                      type="email"
                      placeholder="noreply@empresa.com"
                      {...emailForm.register('remitente_email')}
                    />
                    {emailForm.formState.errors.remitente_email && (
                      <p className="text-sm text-destructive">{emailForm.formState.errors.remitente_email.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Resend API Key</Label>
                    <p className="text-sm text-muted-foreground">
                      La API Key de Resend se almacena de forma segura en Supabase Secrets (RESEND_API_KEY)
                    </p>
                  </div>

                  <Button type="submit" disabled={savingEmail}>
                    {savingEmail ? 'Guardando...' : 'Guardar Configuración'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tema Tab */}
          <TabsContent value="tema">
            <Card>
              <CardHeader>
                <CardTitle>Apariencia</CardTitle>
                <CardDescription>
                  Personaliza el tema de la aplicación
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="space-y-4">
                    <Label>Selecciona un tema</Label>
                    <RadioGroup
                      value={theme || 'system'}
                      onValueChange={handleThemeChange}
                      className="grid grid-cols-3 gap-4"
                    >
                      <div>
                        <RadioGroupItem value="light" id="light" className="peer sr-only" />
                        <Label
                          htmlFor="light"
                          className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                        >
                          <Sun className="mb-3 h-6 w-6" />
                          <span className="text-sm font-medium">Claro</span>
                        </Label>
                      </div>
                      <div>
                        <RadioGroupItem value="dark" id="dark" className="peer sr-only" />
                        <Label
                          htmlFor="dark"
                          className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                        >
                          <Moon className="mb-3 h-6 w-6" />
                          <span className="text-sm font-medium">Oscuro</span>
                        </Label>
                      </div>
                      <div>
                        <RadioGroupItem value="system" id="system" className="peer sr-only" />
                        <Label
                          htmlFor="system"
                          className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                        >
                          <Monitor className="mb-3 h-6 w-6" />
                          <span className="text-sm font-medium">Sistema</span>
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="space-y-2">
                    <Label>Vista previa</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Ejemplo de tarjeta</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground">
                            Este es un ejemplo de cómo se verán los componentes con el tema seleccionado.
                          </p>
                        </CardContent>
                      </Card>
                      <div className="space-y-2">
                        <Button variant="default" className="w-full">Botón primario</Button>
                        <Button variant="secondary" className="w-full">Botón secundario</Button>
                        <Button variant="outline" className="w-full">Botón outline</Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
  );
}
