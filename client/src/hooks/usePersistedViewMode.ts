import { useCallback, useEffect, useState } from 'react';
import { getParsedAccessToken } from '../keycloak';

const STORAGE_NAMESPACE = 'clenzy.viewMode';

function buildStorageKey(screen: string): string {
  const sub = getParsedAccessToken()?.sub ?? 'anon';
  return `${STORAGE_NAMESPACE}.${screen}.${sub}`;
}

function readInitial<T extends string>(
  screen: string,
  defaultValue: T,
  validValues: readonly T[],
): T {
  try {
    const stored = window.localStorage.getItem(buildStorageKey(screen));
    if (stored && (validValues as readonly string[]).includes(stored)) {
      return stored as T;
    }
  } catch {
    // localStorage may be unavailable (SSR, privacy mode) — fall through
  }
  return defaultValue;
}

/**
 * Persiste un mode d'affichage (grid / list / map / ...) en localStorage,
 * scope par utilisateur (sub Keycloak) et par ecran.
 *
 * @param screen   identifiant logique de l'ecran (ex: "properties", "interventions")
 * @param defaultValue valeur initiale si aucune preference enregistree
 * @param validValues  liste blanche pour rejeter les valeurs corrompues / obsoletes
 */
export function usePersistedViewMode<T extends string>(
  screen: string,
  defaultValue: T,
  validValues: readonly T[],
): [T, (mode: T) => void] {
  const [value, setValue] = useState<T>(() => readInitial(screen, defaultValue, validValues));

  useEffect(() => {
    try {
      window.localStorage.setItem(buildStorageKey(screen), value);
    } catch {
      // ignore (quota, private mode)
    }
  }, [screen, value]);

  const update = useCallback((next: T) => {
    setValue(next);
  }, []);

  return [value, update];
}
