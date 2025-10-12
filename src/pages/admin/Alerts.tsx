import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, Play, Pencil, Trash2, BarChart3 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";

const ALERT_TYPES = [
  { value: 'ABSENTISMO_ALTO', label: 'Absentismo Alto' },
  { value: 'COSTE_EXCESIVO', label: 'Coste Excesivo' },
  { value: 'DQ_CRITICA', label: 'Calidad de Datos Crítica' },
  { value: 'PLANIFICACION_VACIA', label: 'Planificación Vacía' },
];

const OPERATORS = [
  { value: 'mayor_que', label: 'Mayor que (>)' },
  { value: 'menor_que', label: 'Menor que (<)' },
  { value: 'igual_a', label: 'Igual a (=)' },
];

const PERIODS = [
  { value: 'ultimo_dia', label: 'Último día' },
  { value: 'ultima_semana', label: 'Última semana' },
  { value: 'ultimo_mes', label: 'Último mes' },
];

export default function Alerts() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [centros, setCentros] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAlert, setEditingAlert] = useState<any>(null);
  const [stats, setStats] = useState({ total: 0, activas: 0, disparadas_hoy: 0 });

  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    tipo: 'ABSENTISMO_ALTO',
    centro: '',
    umbral_valor: '',
    umbral_operador: 'mayor_que',
    periodo_calculo: 'ultimo_mes',
    canal_inapp: true,
    canal_email: false,
    destinatarios_email: '',
    activo: true,
  });

  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      navigate("/dashboard");
      return;
    }
    if (!roleLoading) {
      fetchAlerts();
      fetchCentros();
      fetchStats();
    }
  }, [roleLoading, isAdmin, navigate]);

  const fetchAlerts = async () => {
    try {
      const { data, error } = await supabase
        .from('alerts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAlerts(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCentros = async () => {
    try {
      const { data, error } = await supabase.rpc('get_centros');
      if (error) throw error;
      setCentros(data?.map((d: any) => d.centro) || []);
    } catch (error) {
      console.error('Error fetching centros:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { count: total } = await supabase
        .from('alerts')
        .select('*', { count: 'exact', head: true });

      const { count: activas } = await supabase
        .from('alerts')
        .select('*', { count: 'exact', head: true })
        .eq('activo', true);

      const { count: disparadas } = await supabase
        .from('alert_notifications')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today);

      setStats({
        total: total || 0,
        activas: activas || 0,
        disparadas_hoy: disparadas || 0,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleExecuteNow = async () => {
    setExecuting(true);
    try {
      const { data, error } = await supabase.functions.invoke('compute_alerts');
      
      if (error) throw error;

      toast({
        title: "Alertas ejecutadas",
        description: `Se evaluaron ${data.evaluated} alertas y se dispararon ${data.triggered} notificaciones`,
      });
      
      fetchStats();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setExecuting(false);
    }
  };

  const handleSave = async () => {
    try {
      const canal = [];
      if (formData.canal_inapp) canal.push('inapp');
      if (formData.canal_email) canal.push('email');

      const destinatarios = formData.canal_email 
        ? formData.destinatarios_email.split(',').map(e => e.trim()).filter(e => e)
        : null;

      const alertData = {
        nombre: formData.nombre,
        descripcion: formData.descripcion || null,
        tipo: formData.tipo,
        centro: formData.centro || null,
        umbral_valor: formData.umbral_valor ? parseFloat(formData.umbral_valor) : null,
        umbral_operador: formData.umbral_operador,
        periodo_calculo: formData.periodo_calculo,
        canal,
        destinatarios,
        activo: formData.activo,
      };

      if (editingAlert) {
        const { error } = await supabase
          .from('alerts')
          .update(alertData)
          .eq('id', editingAlert.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('alerts')
          .insert([alertData]);

        if (error) throw error;
      }

      toast({
        title: editingAlert ? "Alerta actualizada" : "Alerta creada",
        description: "Los cambios se han guardado correctamente",
      });

      setDialogOpen(false);
      resetForm();
      fetchAlerts();
      fetchStats();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEdit = (alert: any) => {
    setEditingAlert(alert);
    setFormData({
      nombre: alert.nombre,
      descripcion: alert.descripcion || '',
      tipo: alert.tipo,
      centro: alert.centro || '',
      umbral_valor: alert.umbral_valor?.toString() || '',
      umbral_operador: alert.umbral_operador,
      periodo_calculo: alert.periodo_calculo,
      canal_inapp: alert.canal.includes('inapp'),
      canal_email: alert.canal.includes('email'),
      destinatarios_email: Array.isArray(alert.destinatarios) ? alert.destinatarios.join(', ') : '',
      activo: alert.activo,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta alerta?')) return;

    try {
      const { error } = await supabase
        .from('alerts')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Alerta eliminada",
        description: "La alerta se ha eliminado correctamente",
      });

      fetchAlerts();
      fetchStats();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleToggleActive = async (alert: any) => {
    try {
      const { error } = await supabase
        .from('alerts')
        .update({ activo: !alert.activo })
        .eq('id', alert.id);

      if (error) throw error;

      fetchAlerts();
      fetchStats();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setEditingAlert(null);
    setFormData({
      nombre: '',
      descripcion: '',
      tipo: 'ABSENTISMO_ALTO',
      centro: '',
      umbral_valor: '',
      umbral_operador: 'mayor_que',
      periodo_calculo: 'ultimo_mes',
      canal_inapp: true,
      canal_email: false,
      destinatarios_email: '',
      activo: true,
    });
  };

  if (loading || roleLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Gestión de Alertas</h1>
          <p className="text-muted-foreground">Configurar umbrales y canales de notificación</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleExecuteNow} disabled={executing} variant="outline">
            {executing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
            Ejecutar Ahora
          </Button>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }} modal={true}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nueva Alerta
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingAlert ? 'Editar Alerta' : 'Nueva Alerta'}</DialogTitle>
                <DialogDescription>
                  Configure los parámetros de la alerta
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[70vh] pr-4">
                <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="nombre">Nombre</Label>
                  <Input
                    id="nombre"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    placeholder="Nombre descriptivo"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="descripcion">Descripción</Label>
                  <Textarea
                    id="descripcion"
                    value={formData.descripcion}
                    onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                    placeholder="Descripción opcional"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Tipo de Alerta</Label>
                    <Select value={formData.tipo} onValueChange={(value) => setFormData({ ...formData, tipo: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-[100]">
                        {ALERT_TYPES.map(type => (
                          <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Centro</Label>
                    <Select value={formData.centro} onValueChange={(value) => setFormData({ ...formData, centro: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todos los centros" />
                      </SelectTrigger>
                      <SelectContent className="z-[100]">
                        <SelectItem value="">Todos los centros</SelectItem>
                        {centros.map(centro => (
                          <SelectItem key={centro} value={centro}>{centro}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="grid gap-2">
                    <Label>Umbral</Label>
                    <Input
                      type="number"
                      value={formData.umbral_valor}
                      onChange={(e) => setFormData({ ...formData, umbral_valor: e.target.value })}
                      placeholder="10"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Operador</Label>
                    <Select value={formData.umbral_operador} onValueChange={(value) => setFormData({ ...formData, umbral_operador: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-[100]">
                        {OPERATORS.map(op => (
                          <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Periodo</Label>
                    <Select value={formData.periodo_calculo} onValueChange={(value) => setFormData({ ...formData, periodo_calculo: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-[100]">
                        {PERIODS.map(period => (
                          <SelectItem key={period.value} value={period.value}>{period.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-3">
                  <Label>Canales de Notificación</Label>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={formData.canal_inapp}
                      onCheckedChange={(checked) => setFormData({ ...formData, canal_inapp: checked })}
                    />
                    <Label>Notificación In-App</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={formData.canal_email}
                      onCheckedChange={(checked) => setFormData({ ...formData, canal_email: checked })}
                    />
                    <Label>Enviar Email</Label>
                  </div>
                  {formData.canal_email && (
                    <div className="grid gap-2 pl-8">
                      <Label htmlFor="emails">Emails (separados por coma)</Label>
                      <Input
                        id="emails"
                        value={formData.destinatarios_email}
                        onChange={(e) => setFormData({ ...formData, destinatarios_email: e.target.value })}
                        placeholder="email1@example.com, email2@example.com"
                      />
                    </div>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={formData.activo}
                    onCheckedChange={(checked) => setFormData({ ...formData, activo: checked })}
                  />
                  <Label>Alerta Activa</Label>
                </div>
              </div>
              </ScrollArea>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>
                  Cancelar
                </Button>
                <Button onClick={handleSave}>
                  {editingAlert ? 'Actualizar' : 'Crear'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Alertas</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alertas Activas</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activas}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Disparadas Hoy</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.disparadas_hoy}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Reglas de Alertas</CardTitle>
          <CardDescription>Gestiona las reglas de alertas configuradas</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Estado</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Umbral</TableHead>
                <TableHead>Centro</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alerts.map((alert) => (
                <TableRow key={alert.id}>
                  <TableCell>
                    <Switch
                      checked={alert.activo}
                      onCheckedChange={() => handleToggleActive(alert)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{alert.nombre}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {ALERT_TYPES.find(t => t.value === alert.tipo)?.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {OPERATORS.find(o => o.value === alert.umbral_operador)?.label.charAt(0)} {alert.umbral_valor}
                  </TableCell>
                  <TableCell>{alert.centro || 'Todos'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {alert.canal.includes('inapp') && <Badge variant="secondary">In-App</Badge>}
                      {alert.canal.includes('email') && <Badge variant="secondary">Email</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="icon" variant="ghost" onClick={() => handleEdit(alert)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(alert.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
    </Layout>
  );
}
