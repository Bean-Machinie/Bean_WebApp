/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import type { ThemeId } from './themeList';

type ThemeContextValue = {
  theme: ThemeId;
  loading: boolean;
  status: string | null;
  setThemePreference: (theme: ThemeId) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function applyTheme(theme: ThemeId) {
  document.documentElement.dataset.theme = theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [theme, setTheme] = useState<ThemeId>(() => {
    applyTheme('system');
    return 'system';
  });
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadPreference = async () => {
      if (!user?.id) {
        setTheme('system');
        applyTheme('system');
        setStatus(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('theme_preference')
        .eq('id', user.id)
        .single();

      if (!active) return;

      const preference = (data?.theme_preference as ThemeId | null) ?? 'system';
      setTheme(preference);
      applyTheme(preference);
      setStatus(error && error.code !== 'PGRST116' ? error.message : null);
      setLoading(false);
    };

    loadPreference();

    return () => {
      active = false;
    };
  }, [user?.id]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setThemePreference = useCallback(
    async (value: ThemeId) => {
      setTheme(value);
      applyTheme(value);
      setStatus(null);

      if (!user?.id) return;

      const { error } = await supabase
        .from('profiles')
        .upsert({ id: user.id, theme_preference: value });

      setStatus(error ? error.message : 'Theme saved');
    },
    [user?.id],
  );

  const value = useMemo(
    () => ({ theme, loading, status, setThemePreference }),
    [loading, status, theme, setThemePreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
