import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

interface AuthReadyContextType {
  user: User | null;
  isReady: boolean;
}

const AuthReadyContext = createContext<AuthReadyContextType>({ user: null, isReady: false });

export function AuthReadyProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (isMounted) {
        setUser(session?.user ?? null);
        setIsReady(true);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) {
        setUser(session?.user ?? null);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthReadyContext.Provider value={{ user, isReady }}>
      {children}
    </AuthReadyContext.Provider>
  );
}

export function useAuthReady() {
  return useContext(AuthReadyContext);
}
