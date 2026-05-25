import { useCallback } from 'react';
import { useUserUiPreferences } from '../providers/UserUiPreferencesProvider';

/**
 * Hook generique pour lire/ecrire une preference UI persistee cote backend.
 *
 * <p>Remplace l'usage direct de {@code localStorage} pour les preferences
 * d'affichage (filtres planning, zoom, density, largeur de colonnes, etc.) —
 * permet la portabilite cross-devices et cross-navigateurs.</p>
 *
 * <p>Le caller fournit un {@code defaultValue} typesafe, retourne tant que
 * la pref n'a pas encore ete chargee (initial loading) ou n'existe pas
 * cote serveur.</p>
 *
 * @example
 * const [zoom, setZoom] = useUserPreference<'day' | 'week' | 'month'>('planning.zoom', 'week');
 *
 * @example
 * const [filters, setFilters, { isLoading, reset }] = useUserPreference<MyFilters>(
 *   'planning.filters',
 *   DEFAULT_FILTERS,
 * );
 *
 * @param key cle dot-notation (ex: 'planning.filters'). Max 120 chars.
 * @param defaultValue valeur de retour tant que la pref n'est pas chargee
 *                      ou si elle n'existe pas serveur-side.
 */
export function useUserPreference<T>(
  key: string,
  defaultValue: T,
): [
  T,
  (next: T) => void,
  { isLoading: boolean; reset: () => void },
] {
  const { prefs, isLoading, setPref, deletePref } = useUserUiPreferences();

  const raw = prefs[key];
  const value = (raw === undefined ? defaultValue : raw) as T;

  const setValue = useCallback(
    (next: T) => {
      setPref(key, next);
    },
    [key, setPref],
  );

  const reset = useCallback(() => {
    deletePref(key);
  }, [key, deletePref]);

  return [value, setValue, { isLoading, reset }];
}
