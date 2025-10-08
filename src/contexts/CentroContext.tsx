import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { useUserRole } from "@/hooks/useUserRole";

interface CentroContextType {
  selectedCentro: string | null;
  setSelectedCentro: (centro: string | null) => void;
  availableCentros: string[];
}

const CentroContext = createContext<CentroContextType | undefined>(undefined);

export const CentroProvider = ({ children }: { children: ReactNode }) => {
  const { centros, isAdmin, loading } = useUserRole();
  const [selectedCentro, setSelectedCentro] = useState<string | null>(null);

  useEffect(() => {
    // If user only has 1 centro, select it automatically
    if (!loading && !isAdmin && centros.length === 1) {
      setSelectedCentro(centros[0]);
    }
  }, [centros, isAdmin, loading]);

  return (
    <CentroContext.Provider
      value={{
        selectedCentro,
        setSelectedCentro,
        availableCentros: isAdmin ? [] : centros,
      }}
    >
      {children}
    </CentroContext.Provider>
  );
};

export const useCentro = () => {
  const context = useContext(CentroContext);
  if (!context) throw new Error("useCentro must be used within CentroProvider");
  return context;
};
