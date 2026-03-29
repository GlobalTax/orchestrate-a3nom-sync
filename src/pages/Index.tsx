import { Navigate } from "react-router-dom";
import { useAuthReady } from "@/hooks/useAuthReady";
import { Loader2 } from "lucide-react";

const Index = () => {
  const { user, isReady } = useAuthReady();

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Navigate to="/auth" replace />;
};

export default Index;
