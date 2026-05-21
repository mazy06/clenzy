import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import userPreferencesApi from '../services/api/userPreferencesApi';
import type { UserPreferencesDto } from '../services/api/userPreferencesApi';

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
  notifyEmail: true,
  notifyPush: false,
  notifySms: false,
}) as UserPreferencesDto;

/**
 * Hook pour les preferences utilisateur persistees en BDD.
 * Source de verite pour timezone, devise, langue et toggles notifications.
 * Les preferences sont chargees depuis le backend et mises en cache par React Query.
 */
export function useUserPreferences() {
  const queryClient = useQueryClient();

  const { data: preferences, isLoading } = useQuery<UserPreferencesDto>({
    queryKey: QUERY_KEY,
    queryFn: userPreferencesApi.getMyPreferences,
    staleTime: 5 * 60 * 1000, // 5 minutes
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
    isLoading,
    isSaving: updateMutation.isPending,
    updatePreferences,
  };
}
