import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, CheckCircle2, XCircle, AlertCircle, Info } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const SEVERITY_CONFIG = {
  baja: { color: 'bg-blue-100 text-blue-800', icon: Info },
  media: { color: 'bg-yellow-100 text-yellow-800', icon: AlertCircle },
  alta: { color: 'bg-orange-100 text-orange-800', icon: AlertCircle },
  critica: { color: 'bg-red-100 text-red-800', icon: XCircle },
};

export default function Notifications() {
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterLeida, setFilterLeida] = useState<'all' | 'leida' | 'no_leida'>('all');
  const [selectedNotification, setSelectedNotification] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    fetchNotifications();

    // Real-time subscription
    const channel = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'alert_notifications',
        },
        (payload) => {
          setNotifications((prev) => [payload.new, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchNotifications = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('alert_notifications')
        .select('*')
        .eq('destinatario_user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
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

  const handleMarkAsRead = async (id: string) => {
    try {
      const { error } = await supabase
        .from('alert_notifications')
        .update({ leida: true, leida_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      setNotifications((prev) =>
        prev.map((notif) => (notif.id === id ? { ...notif, leida: true, leida_at: new Date().toISOString() } : notif))
      );
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleMarkAsUnread = async (id: string) => {
    try {
      const { error } = await supabase
        .from('alert_notifications')
        .update({ leida: false, leida_at: null })
        .eq('id', id);

      if (error) throw error;

      setNotifications((prev) =>
        prev.map((notif) => (notif.id === id ? { ...notif, leida: false, leida_at: null } : notif))
      );
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const unreadIds = notifications.filter(n => !n.leida).map(n => n.id);
      
      const { error } = await supabase
        .from('alert_notifications')
        .update({ leida: true, leida_at: new Date().toISOString() })
        .in('id', unreadIds);

      if (error) throw error;

      fetchNotifications();
      toast({
        title: "Notificaciones marcadas",
        description: "Todas las notificaciones se han marcado como leídas",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleViewDetails = (notification: any) => {
    setSelectedNotification(notification);
    setDetailOpen(true);
    if (!notification.leida) {
      handleMarkAsRead(notification.id);
    }
  };

  const filteredNotifications = notifications.filter((notif) => {
    if (filterLeida === 'leida') return notif.leida;
    if (filterLeida === 'no_leida') return !notif.leida;
    return true;
  });

  const unreadCount = notifications.filter(n => !n.leida).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Notificaciones</h1>
          <p className="text-muted-foreground">
            {unreadCount > 0 ? `Tienes ${unreadCount} notificaciones sin leer` : 'No tienes notificaciones sin leer'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={filterLeida === 'all' ? 'default' : 'outline'}
            onClick={() => setFilterLeida('all')}
          >
            Todas
          </Button>
          <Button
            variant={filterLeida === 'no_leida' ? 'default' : 'outline'}
            onClick={() => setFilterLeida('no_leida')}
          >
            No leídas
          </Button>
          <Button
            variant={filterLeida === 'leida' ? 'default' : 'outline'}
            onClick={() => setFilterLeida('leida')}
          >
            Leídas
          </Button>
          {unreadCount > 0 && (
            <Button onClick={handleMarkAllAsRead} variant="outline">
              Marcar todas como leídas
            </Button>
          )}
        </div>
      </div>

      {filteredNotifications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle2 className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No hay notificaciones</p>
            <p className="text-muted-foreground">
              {filterLeida === 'no_leida' ? 'No tienes notificaciones sin leer' : 'No tienes notificaciones'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredNotifications.map((notif) => {
            const SeverityIcon = SEVERITY_CONFIG[notif.severidad as keyof typeof SEVERITY_CONFIG]?.icon || Info;
            const severityColor = SEVERITY_CONFIG[notif.severidad as keyof typeof SEVERITY_CONFIG]?.color || 'bg-gray-100 text-gray-800';

            return (
              <Card
                key={notif.id}
                className={`cursor-pointer transition-colors hover:bg-accent ${!notif.leida ? 'border-l-4 border-l-primary' : ''}`}
                onClick={() => handleViewDetails(notif)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-full ${severityColor}`}>
                      <SeverityIcon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h3 className="font-semibold text-base truncate">{notif.titulo}</h3>
                        <Badge className={severityColor}>
                          {notif.severidad}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{notif.mensaje}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{format(new Date(notif.created_at), "d 'de' MMMM 'a las' HH:mm", { locale: es })}</span>
                        {notif.centro && <span>Centro: {notif.centro}</span>}
                        <Badge variant="outline">{notif.tipo}</Badge>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {!notif.leida ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkAsRead(notif.id);
                          }}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkAsUnread(notif.id);
                          }}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedNotification && (
                <>
                  {(() => {
                    const SeverityIcon = SEVERITY_CONFIG[selectedNotification.severidad as keyof typeof SEVERITY_CONFIG]?.icon || Info;
                    const severityColor = SEVERITY_CONFIG[selectedNotification.severidad as keyof typeof SEVERITY_CONFIG]?.color || 'bg-gray-100 text-gray-800';
                    return (
                      <div className={`p-2 rounded-full ${severityColor}`}>
                        <SeverityIcon className="h-5 w-5" />
                      </div>
                    );
                  })()}
                  {selectedNotification.titulo}
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedNotification && format(new Date(selectedNotification.created_at), "d 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es })}
            </DialogDescription>
          </DialogHeader>
          {selectedNotification && (
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Mensaje</h4>
                <p className="text-sm">{selectedNotification.mensaje}</p>
              </div>
              {selectedNotification.detalles && (
                <div>
                  <h4 className="font-semibold mb-2">Detalles</h4>
                  <div className="bg-muted p-4 rounded-lg">
                    <pre className="text-xs whitespace-pre-wrap overflow-auto">
                      {JSON.stringify(selectedNotification.detalles, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
              <div className="flex gap-4 text-sm text-muted-foreground">
                <div>
                  <span className="font-semibold">Tipo:</span> {selectedNotification.tipo}
                </div>
                {selectedNotification.centro && (
                  <div>
                    <span className="font-semibold">Centro:</span> {selectedNotification.centro}
                  </div>
                )}
                <div>
                  <span className="font-semibold">Severidad:</span> {selectedNotification.severidad}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
