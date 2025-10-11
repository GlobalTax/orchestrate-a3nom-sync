import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  text?: string;
}

const sizeClasses = {
  sm: "h-4 w-4",
  md: "h-8 w-8",
  lg: "h-12 w-12",
};

export const LoadingSpinner = ({ size = "md", className, text }: LoadingSpinnerProps) => {
  return (
    <div className="flex flex-col items-center justify-center py-8 gap-3">
      <Loader2 className={cn(sizeClasses[size], "animate-spin text-primary", className)} />
      {text && <p className="text-sm text-muted-foreground">{text}</p>}
    </div>
  );
};
