import { useEffect } from "react";
import { useTheme } from "next-themes";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "./useAuthReady";

export const useUserTheme = () => {
  const { setTheme, theme } = useTheme();
  const { user, isReady } = useAuthReady();

  useEffect(() => {
    if (!isReady || !user) return;

    const loadUserTheme = async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('theme')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.theme && profile.theme !== theme) {
        setTheme(profile.theme);
      }
    };

    loadUserTheme();
  }, [setTheme, theme, user, isReady]);

  const updateUserTheme = async (newTheme: 'light' | 'dark' | 'system') => {
    if (!user) return { error: new Error('Usuario no autenticado') };

    setTheme(newTheme);
    
    const { error } = await supabase
      .from('profiles')
      .update({ theme: newTheme })
      .eq('id', user.id);

    return { error };
  };

  return { updateUserTheme };
};
