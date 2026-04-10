import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type AppTheme = 'panorama' | 'island';

const STORAGE_KEY = 'godlykids_theme';
const DEFAULT_THEME: AppTheme = 'panorama';

interface ThemeContextType {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  isPanorama: boolean;
  isIsland: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: DEFAULT_THEME,
  setTheme: () => {},
  isPanorama: true,
  isIsland: false,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'panorama' || stored === 'island') return stored;
    } catch {}
    return DEFAULT_THEME;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {}
  }, [theme]);

  const setTheme = useCallback((newTheme: AppTheme) => {
    setThemeState(newTheme);
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        isPanorama: theme === 'panorama',
        isIsland: theme === 'island',
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
