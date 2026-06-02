import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  marketingIntegrationApi,
  type MarketingListsPayload,
  type MarketingTogglesPayload,
} from '../services/api/marketingIntegrationApi';

const MARKETING_KEY = ['marketing-integration'] as const;
const BREVO_LISTS_KEY = ['brevo-lists'] as const;

export function useMarketingIntegration(enabled = true) {
  return useQuery({
    queryKey: MARKETING_KEY,
    queryFn: () => marketingIntegrationApi.get(),
    staleTime: 60_000,
    enabled,
  });
}

/** Listes Brevo (pour les menus de mapping). N'est appelé que si une clé est configurée. */
export function useBrevoLists(enabled: boolean) {
  return useQuery({
    queryKey: BREVO_LISTS_KEY,
    queryFn: () => marketingIntegrationApi.brevoLists(),
    enabled,
    staleTime: 60_000,
  });
}

export function useSetBrevoApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (apiKey: string) => marketingIntegrationApi.setApiKey(apiKey),
    onSuccess: (data) => {
      queryClient.setQueryData(MARKETING_KEY, data);
      queryClient.invalidateQueries({ queryKey: BREVO_LISTS_KEY });
    },
  });
}

export function useSetMarketingLists() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: MarketingListsPayload) => marketingIntegrationApi.setLists(payload),
    onSuccess: (data) => queryClient.setQueryData(MARKETING_KEY, data),
  });
}

export function useSetMarketingToggles() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: MarketingTogglesPayload) => marketingIntegrationApi.setToggles(payload),
    onSuccess: (data) => queryClient.setQueryData(MARKETING_KEY, data),
  });
}

export function useTestBrevo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => marketingIntegrationApi.test(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MARKETING_KEY });
      queryClient.invalidateQueries({ queryKey: BREVO_LISTS_KEY });
    },
  });
}
