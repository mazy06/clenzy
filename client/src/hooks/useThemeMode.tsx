import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useUserPreferences } from './useUserPreferences';
import keycloak from '../keycloak';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ThemeMode = 'light' | 'dark' | 'auto';

interface ThemeModeContextType {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  isDark: boolean; // resolved current state (true if dark, false if light)
}

// ─── Constants ──────────────────────────────────────────────────────────────

// Cache localStorage : lecture synchrone au boot pour eviter le FOUC (flash
// du theme par defaut avant que le backend reponde). Source de verite =
// user_preferences.theme_mode cote backend (migration 0136).
const THEME_MODE_KEY = 'clenzy_theme_mode';

function isValidMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'auto';
}

// ─── Context ────────────────────────────────────────────────────────────────

const ThemeModeContext = createContext<ThemeModeContextType | undefined>(undefined);

// ─── Helper: read preferred color scheme from OS ────────────────────────────

function getSystemPrefersDark(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

// ─── Helper: read saved mode from localStorage ─────────────────────────────

function getSavedMode(): ThemeMode {
  try {
    const saved = localStorage.getItem(THEME_MODE_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'auto') {
      return saved;
    }
    // Fallback: check legacy clenzy_settings for darkMode boolean
    const settingsRaw = localStorage.getItem('clenzy_settings');
    if (settingsRaw) {
      const settings = JSON.parse(settingsRaw);
      if (settings?.display?.theme === 'dark') return 'dark';
      if (settings?.display?.theme === 'auto') return 'auto';
    }
  } catch {
    // Silent fail
  }
  return 'auto';
}

// ─── Helper: resolve isDark from mode ───────────────────────────────────────

function resolveIsDark(mode: ThemeMode): boolean {
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  // auto → follow system
  return getSystemPrefersDark();
}

// ─── Provider ───────────────────────────────────────────────────────────────

interface ThemeModeProviderProps {
  children: React.ReactNode;
}

export function ThemeModeProvider({ children }: ThemeModeProviderProps) {
  // Boot synchrone depuis localStorage (anti-FOUC). Le backend ecrasera
  // cette valeur via le useEffect ci-dessous des qu'il repond.
  const [mode, setModeState] = useState<ThemeMode>(getSavedMode);
  const [systemDark, setSystemDark] = useState<boolean>(getSystemPrefersDark);

  // Sync backend → local (source de verite = user_preferences.theme_mode).
  // Ignore si pas authentifie. Le cache localStorage reste valide en fallback.
  const { preferences, updatePreferences } = useUserPreferences();
  useEffect(() => {
    if (!keycloak.authenticated) return;
    const serverMode = preferences.themeMode;
    if (!isValidMode(serverMode)) return;
    if (serverMode === mode) return;
    setModeState(serverMode);
    try {
      localStorage.setItem(THEME_MODE_KEY, serverMode);
    } catch {
      // Silent fail
    }
  }, [preferences.themeMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for system color scheme changes (only relevant in 'auto' mode)
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    // Event-based detection (works in Safari, Firefox, standard Chrome)
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemDark(e.matches);
    };
    mediaQuery.addEventListener('change', handleChange);

    // Polling fallback for browsers that don't fire the change event
    // reliably (Arc Browser, some Chromium forks).
    // Checks every 30s — lightweight and only updates state if value changed.
    const pollInterval = setInterval(() => {
      const current = mediaQuery.matches;
      setSystemDark((prev) => (prev !== current ? current : prev));
    }, 30_000);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
      clearInterval(pollInterval);
    };
  }, []);

  // Optimistic update : local + cache immediatement, puis push backend.
  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    try {
      localStorage.setItem(THEME_MODE_KEY, newMode);

      // Also sync with clenzy_settings for backward compatibility
      const settingsRaw = localStorage.getItem('clenzy_settings');
      if (settingsRaw) {
        const settings = JSON.parse(settingsRaw);
        if (settings?.display) {
          settings.display.theme = newMode === 'auto' ? 'auto' : newMode;
          localStorage.setItem('clenzy_settings', JSON.stringify(settings));
        }
      }
    } catch {
      // Silent fail
    }
    if (keycloak.authenticated) {
      updatePreferences({ themeMode: newMode }).catch(() => {
        // Best-effort : si la PUT echoue, la valeur locale persiste
        // jusqu'au prochain sync backend.
      });
    }
  }, [updatePreferences]);

  // Resolve whether currently dark
  const isDark = useMemo(() => {
    if (mode === 'dark') return true;
    if (mode === 'light') return false;
    return systemDark; // 'auto' mode
  }, [mode, systemDark]);

  const contextValue = useMemo<ThemeModeContextType>(
    () => ({ mode, setMode, isDark }),
    [mode, setMode, isDark]
  );

  return (
    <ThemeModeContext.Provider value={contextValue}>
      {children}
    </ThemeModeContext.Provider>
  );
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useThemeMode(): ThemeModeContextType {
  const context = useContext(ThemeModeContext);
  if (!context) {
    throw new Error('useThemeMode must be used within a ThemeModeProvider');
  }
  return context;
}
