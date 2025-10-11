import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  title?: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const EmptyState = ({ icon: Icon, title, message, action }: EmptyStateProps) => {
  const IconComponent = Icon || FileQuestion;

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <IconComponent className="h-16 w-16 text-muted-foreground/50 mb-4" />
      {title && <h3 className="text-lg font-semibold mb-2">{title}</h3>}
      <p className="text-muted-foreground mb-6 max-w-md">{message}</p>
      {action && (
        <Button onClick={action.onClick} variant="outline">
          {action.label}
        </Button>
      )}
    </div>
  );
};
