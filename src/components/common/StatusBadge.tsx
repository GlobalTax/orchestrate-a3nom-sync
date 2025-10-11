import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface StatusBadgeProps {
  status: "active" | "inactive" | "pending" | "success" | "error" | "warning";
  label?: string;
  className?: string;
}

const statusConfig = {
  active: {
    label: "Activo",
    className: "bg-green-500/10 text-green-700 dark:text-green-400 hover:bg-green-500/20",
  },
  inactive: {
    label: "Inactivo",
    className: "bg-gray-500/10 text-gray-700 dark:text-gray-400 hover:bg-gray-500/20",
  },
  pending: {
    label: "Pendiente",
    className: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-500/20",
  },
  success: {
    label: "Éxito",
    className: "bg-green-500/10 text-green-700 dark:text-green-400 hover:bg-green-500/20",
  },
  error: {
    label: "Error",
    className: "bg-red-500/10 text-red-700 dark:text-red-400 hover:bg-red-500/20",
  },
  warning: {
    label: "Advertencia",
    className: "bg-orange-500/10 text-orange-700 dark:text-orange-400 hover:bg-orange-500/20",
  },
};

export const StatusBadge = ({ status, label, className }: StatusBadgeProps) => {
  const config = statusConfig[status];
  
  return (
    <Badge className={cn(config.className, className)} variant="outline">
      {label || config.label}
    </Badge>
  );
};
