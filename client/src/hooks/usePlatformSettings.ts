import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { platformSettingsApi } from '../services/api/platformSettingsApi';

const PLATFORM_SETTINGS_KEY = ['platform-settings'] as const;

export function usePlatformSettings(enabled = true) {
  return useQuery({
    queryKey: PLATFORM_SETTINGS_KEY,
    queryFn: () => platformSettingsApi.get(),
    staleTime: 60_000,
    enabled,
  });
}

export function useSetProspectDevisEmails() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) => platformSettingsApi.setProspectDevisEmails(enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLATFORM_SETTINGS_KEY });
    },
  });
}

export function useSetDevisLeadsToWaitlist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) => platformSettingsApi.setDevisLeadsToWaitlist(enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLATFORM_SETTINGS_KEY });
    },
  });
}
