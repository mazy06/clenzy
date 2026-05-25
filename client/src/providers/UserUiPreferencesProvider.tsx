import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { userUiPreferencesApi } from '../services/api/userUiPreferencesApi';
import keycloak from '../keycloak';

/**
 * Contexte des preferences UI persistees cote backend.
 *
 * <p>Remplace localStorage pour les preferences d'affichage (filtres planning,
 * zoom, density, largeur de colonnes, etc.) afin qu'elles traversent les
 * devices et les navigateurs.</p>
 *
 * <p>Flow :
 * <ol>
 *   <li>Au mount du Provider, un GET unique recupere toutes les prefs de l'user.</li>
 *   <li>Les hooks {@code useUserPreference} consomment le cache du context.</li>
 *   <li>Les ecritures sont optimistes + debounced (350ms) en PUT background.</li>
 *   <li>Les erreurs reseau sont swallow (best-effort).</li>
 * </ol>
 * </p>
 *
 * @see useUserPreference
 */

type Prefs = Record<string, unknown>;

interface UserUiPreferencesContextValue {
  prefs: Prefs;
  isLoading: boolean;
  /** Update local + queue debounced PUT to server. */
  setPref: <T>(key: string, value: T) => void;
  /** Delete locally + DELETE on server. */
  deletePref: (key: string) => void;
}

const UserUiPreferencesContext = createContext<UserUiPreferencesContextValue | null>(null);

const DEBOUNCE_MS = 350;

export function UserUiPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Map<key, NodeJS.Timeout> — timers de debounce par cle
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Charger toutes les preferences au mount (et au changement de user)
  useEffect(() => {
    let cancelled = false;

    // Si pas authentifie, ne pas tenter le GET (eviterait un 401)
    if (!keycloak.authenticated) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    userUiPreferencesApi
      .list()
      .then((data) => {
        if (cancelled) return;
        setPrefs(data ?? {});
      })
      .catch(() => {
        // Best-effort : si le backend repond 401/500, on continue avec un cache vide.
        // Les hooks consommateurs retourneront leur defaultValue.
        if (cancelled) return;
        setPrefs({});
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Cleanup des timers en cas d'unmount
  useEffect(() => {
    const timers = debounceTimers.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  const setPref = useCallback(<T,>(key: string, value: T) => {
    // 1. Optimistic update local
    setPrefs((prev) => ({ ...prev, [key]: value }));

    // 2. Debounce la PUT — evite les hammering en cas de modifs rapides successives
    const existing = debounceTimers.current.get(key);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      debounceTimers.current.delete(key);
      userUiPreferencesApi.upsert(key, value).catch(() => {
        // Best-effort : si la PUT echoue, on garde la valeur locale.
        // Au prochain reload, elle sera ecrasee par la valeur serveur (defaut).
      });
    }, DEBOUNCE_MS);
    debounceTimers.current.set(key, timer);
  }, []);

  const deletePref = useCallback((key: string) => {
    // Optimistic local delete
    setPrefs((prev) => {
      if (!(key in prev)) return prev;
      const { [key]: _omit, ...rest } = prev;
      return rest;
    });

    const existing = debounceTimers.current.get(key);
    if (existing) clearTimeout(existing);
    debounceTimers.current.delete(key);

    userUiPreferencesApi.delete(key).catch(() => {
      // Best-effort
    });
  }, []);

  const value = useMemo<UserUiPreferencesContextValue>(
    () => ({ prefs, isLoading, setPref, deletePref }),
    [prefs, isLoading, setPref, deletePref],
  );

  return (
    <UserUiPreferencesContext.Provider value={value}>{children}</UserUiPreferencesContext.Provider>
  );
}

/**
 * Hook bas-niveau : retourne le context entier. Prefere {@link useUserPreference}
 * pour la plupart des cas.
 */
export function useUserUiPreferences(): UserUiPreferencesContextValue {
  const ctx = useContext(UserUiPreferencesContext);
  if (!ctx) {
    throw new Error('useUserUiPreferences must be used within <UserUiPreferencesProvider>');
  }
  return ctx;
}
