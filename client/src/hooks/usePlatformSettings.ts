import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { platformSettingsApi, type ConciergeSettingsUpdate } from '../services/api/platformSettingsApi';

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

export function useSetInternalNotificationEmails() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (emails: string[]) => platformSettingsApi.setInternalNotificationEmails(emails),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLATFORM_SETTINGS_KEY });
    },
  });
}

export function useSetSender() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ email, name }: { email: string; name: string }) =>
      platformSettingsApi.setSender(email, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLATFORM_SETTINGS_KEY });
    },
  });
}

export function useSetConciergeSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ConciergeSettingsUpdate) => platformSettingsApi.setConcierge(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLATFORM_SETTINGS_KEY });
    },
  });
}
