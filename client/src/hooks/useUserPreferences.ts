import { useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import userPreferencesApi from '../services/api/userPreferencesApi';
import type { UserPreferencesDto } from '../services/api/userPreferencesApi';
import { useIsAuthenticated } from './useIsAuthenticated';

const QUERY_KEY = ['user-preferences', 'me'];

/**
 * Defaults declares en CONSTANTE (hors du hook) pour preserver la stabilite
 * referentielle entre renders. Sans ca, le fallback `preferences ?? { ... }`
 * recreait l'objet a chaque render → tout useEffect/useMemo en aval avec
 * `preferences` dans son dependency array tournait en boucle infinie.
 * (Cause d'un Maximum update depth exceeded dans Settings.tsx.)
 */
const DEFAULT_PREFERENCES: UserPreferencesDto = Object.freeze({
  timezone: 'Europe/Paris',
  currency: 'EUR',
  language: 'fr',
  themeMode: 'auto',
  notifyEmail: true,
  notifyPush: false,
  notifySms: false,
}) as UserPreferencesDto;

/**
 * Hook pour les preferences utilisateur persistees en BDD.
 * Source de verite pour timezone, devise, langue, theme et toggles notifications.
 * Les preferences sont chargees depuis le backend et mises en cache par React Query.
 *
 * <h2>Gating auth (BUG-1)</h2>
 * <p>La query est gatee par {@link useIsAuthenticated} pour ne pas spammer
 * de 401 au boot avant que Keycloak soit pret. Quand l'auth devient
 * disponible, react-query refetch automatiquement.</p>
 *
 * <h2>Distinction loaded vs default (BUG-2)</h2>
 * <p>{@code preferences} retourne toujours une valeur (fallback DEFAULT_PREFERENCES)
 * pour les consumers qui ont besoin d'une valeur a chaque render.
 * {@code isLoaded} est {@code true} ssi le backend a repondu OK au moins
 * une fois — les consumers qui veulent eviter d'ecraser une valeur locale
 * avec les defaults (cf. CurrencyProvider, ThemeModeProvider) doivent
 * gater leur sync sur ce flag.</p>
 */
export function useUserPreferences() {
  const queryClient = useQueryClient();
  const isAuthed = useIsAuthenticated();

  // Privacy : purge la cache react-query au logout pour eviter qu'un user B
  // qui se connecte sur le meme tab apres user A voie les prefs de A (la
  // cache reste sinon en memoire pendant gcTime = 5 min par defaut).
  useEffect(() => {
    if (!isAuthed) {
      queryClient.removeQueries({ queryKey: QUERY_KEY });
    }
  }, [isAuthed, queryClient]);

  const { data: preferences, isLoading, isSuccess } = useQuery<UserPreferencesDto>({
    queryKey: QUERY_KEY,
    queryFn: userPreferencesApi.getMyPreferences,
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: isAuthed,
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<UserPreferencesDto>) =>
      userPreferencesApi.updateMyPreferences(data),
    onSuccess: (updated) => {
      queryClient.setQueryData(QUERY_KEY, updated);
    },
  });

  const updatePreferences = useCallback(
    (data: Partial<UserPreferencesDto>) => updateMutation.mutateAsync(data),
    [updateMutation],
  );

  return {
    preferences: preferences ?? DEFAULT_PREFERENCES,
    /** {@code true} ssi la query a recupere des donnees backend (vs fallback). */
    isLoaded: isSuccess && preferences !== undefined,
    isLoading,
    isSaving: updateMutation.isPending,
    updatePreferences,
  };
}
