import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useUserPreferences } from './useUserPreferences';
import { useIsAuthenticated } from './useIsAuthenticated';
import {
  type AccentName,
  DEFAULT_ACCENT,
  ACCENT_OPTIONS,
  getSavedAccent,
  setAccent as persistAccentLocal,
} from '../theme/signature/accent';

interface AccentContextType {
  accent: AccentName;
  setAccent: (accent: AccentName) => void;
}

const AccentContext = createContext<AccentContextType | undefined>(undefined);

function isValidAccent(value: unknown): value is AccentName {
  return ACCENT_OPTIONS.some((o) => o.value === value);
}

/**
 * Teinte d'accent paramétrable PAR UTILISATEUR, persistée en BDD
 * (`user_preferences.accent`) — source de vérité cross-device.
 *
 * Même pattern que {@link useThemeMode} / CurrencyProvider :
 *  - boot synchrone depuis localStorage (anti-FOUC ; `applyThemeAttributesAtBoot`
 *    a déjà posé `data-accent` avant le premier paint) ;
 *  - sync backend → local gatée par `isLoaded` (ne jamais écraser le local avec
 *    le défaut serveur tant que le backend n'a pas répondu, cf. BUG-2) ;
 *  - au premier chargement, si le serveur est encore au défaut mais le local
 *    diffère, on POUSSE le choix local vers la BDD (migration du localStorage) ;
 *  - `setAccent` : optimiste (localStorage + `data-accent`) puis PUT backend.
 */
export function AccentProvider({ children }: { children: React.ReactNode }) {
  const [accent, setAccentState] = useState<AccentName>(getSavedAccent);

  const { preferences, isLoaded, updatePreferences } = useUserPreferences();
  const isAuthed = useIsAuthenticated();
  const initialPushDoneRef = useRef(false);

  useEffect(() => {
    if (!isLoaded) return;
    const serverAccent = preferences.accent;
    if (!isValidAccent(serverAccent)) return;

    // Premier passage : si le serveur est au défaut mais le local diffère, on
    // migre le choix local vers la BDD (au lieu d'écraser le local par défaut).
    if (!initialPushDoneRef.current && serverAccent === DEFAULT_ACCENT && accent !== DEFAULT_ACCENT) {
      initialPushDoneRef.current = true;
      if (isAuthed) updatePreferences({ accent }).catch(() => { /* best-effort */ });
      return;
    }
    initialPushDoneRef.current = true;

    if (serverAccent === accent) return;
    setAccentState(serverAccent);
    persistAccentLocal(serverAccent); // localStorage + data-accent
  }, [isLoaded, preferences.accent]); // eslint-disable-line react-hooks/exhaustive-deps

  const setAccent = useCallback((next: AccentName) => {
    setAccentState(next);
    persistAccentLocal(next); // optimiste : localStorage + data-accent (reteinte CSS)
    if (isAuthed) {
      updatePreferences({ accent: next }).catch(() => { /* best-effort */ });
    }
  }, [isAuthed, updatePreferences]);

  const value = useMemo<AccentContextType>(() => ({ accent, setAccent }), [accent, setAccent]);
  return <AccentContext.Provider value={value}>{children}</AccentContext.Provider>;
}

export function useAccent(): AccentContextType {
  const ctx = useContext(AccentContext);
  if (!ctx) {
    throw new Error('useAccent must be used within an AccentProvider');
  }
  return ctx;
}
