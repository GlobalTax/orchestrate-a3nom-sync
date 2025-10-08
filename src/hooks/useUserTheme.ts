import { useEffect } from "react";
import { useTheme } from "next-themes";
import { supabase } from "@/integrations/supabase/client";

export const useUserTheme = () => {
  const { setTheme, theme } = useTheme();

  useEffect(() => {
    const loadUserTheme = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

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
  }, [setTheme, theme]);

  const updateUserTheme = async (newTheme: 'light' | 'dark' | 'system') => {
    const { data: { user } } = await supabase.auth.getUser();
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
