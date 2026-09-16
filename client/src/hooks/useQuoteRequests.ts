import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { quoteRequestsApi } from '../services/api/quoteRequestsApi';
import type { CreateQuotePayload, QuoteRequestStatus } from '../services/api/quoteRequestsApi';
import { invalidateMissionWorkflow } from './invalidateMissionWorkflow';
import { useNotification } from './useNotification';
import { useTranslation } from './useTranslation';

export const quoteKeys = {
  all: ['quote-requests'] as const,
  sent: (status: QuoteRequestStatus[] | undefined, page: number) =>
    [...quoteKeys.all, 'sent', status, page] as const,
  received: (status: QuoteRequestStatus[] | undefined, page: number) =>
    [...quoteKeys.all, 'received', status, page] as const,
  pendingCount: () => [...quoteKeys.all, 'pending-count'] as const,
};

export function useSentQuotes(status?: QuoteRequestStatus[], page = 0) {
  const { user, loading } = useAuth();
  const scope = JSON.stringify([user?.id, user?.organizationId]);
  return useQuery({
    queryKey: [...quoteKeys.sent(status, page), scope],
    queryFn: () => quoteRequestsApi.sent(status, page),
    enabled: !!user && !loading,
    placeholderData: (previous, query) => query?.queryKey.at(-1) === scope ? previous : undefined,
  });
}

export function useReceivedQuotes(status?: QuoteRequestStatus[], page = 0) {
  const { user, loading } = useAuth();
  const scope = JSON.stringify([user?.id, user?.organizationId]);
  return useQuery({
    queryKey: [...quoteKeys.received(status, page), scope],
    queryFn: () => quoteRequestsApi.received(status, page),
    enabled: !!user && !loading,
    placeholderData: (previous, query) => query?.queryKey.at(-1) === scope ? previous : undefined,
  });
}

/**
 * Combien de demandes attendent une réponse.
 *
 * `retry: false` : un compte sans fiche prestataire reçoit un 403, et réessayer
 * ne le fera pas apparaître. L'écran s'en sert pour savoir s'il doit proposer
 * l'espace prestataire.
 */
export function usePendingQuoteCount() {
  const { user, loading } = useAuth();
  return useQuery({
    queryKey: [...quoteKeys.pendingCount(), user?.id, user?.organizationId],
    queryFn: () => quoteRequestsApi.pendingCount(),
    enabled: !!user && !loading,
    retry: false,
    staleTime: 60 * 1000,
  });
}

export function useCreateQuoteRequest(replacementQuoteId?: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateQuotePayload) => replacementQuoteId
      ? quoteRequestsApi.replace(replacementQuoteId, payload.providerId, payload.desiredDate, payload.categoryCode, payload.serviceItemCode)
      : quoteRequestsApi.create(payload),
    onSuccess: () => {
      void invalidateMissionWorkflow(queryClient);
    },
  });
}

/**
 * Toutes les transitions passent par ici.
 *
 * Une seule mutation plutôt que six : elles invalident toutes la même chose, et
 * l'écran choisit l'action au moment du clic — pas à la déclaration.
 */
export function useQuoteTransition() {
  const queryClient = useQueryClient();
  const { notify } = useNotification();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({ id, action, reason, amount, currency, message, validUntil, providerTeamId }: {
      id: number;
      action: 'accept' | 'decline' | 'withdraw' | 'quote' | 'turnDown';
      reason?: string;
      amount?: number;
      currency?: string;
      message?: string;
      validUntil?: string;
      providerTeamId?: number;
    }) => {
      switch (action) {
        case 'accept': return quoteRequestsApi.accept(id);
        case 'decline': return quoteRequestsApi.decline(id, reason);
        case 'withdraw': return quoteRequestsApi.withdraw(id, reason);
        case 'turnDown': return quoteRequestsApi.turnDown(id, reason);
        case 'quote': return quoteRequestsApi.quote(
          id, amount as number, currency ?? 'EUR', message, validUntil, providerTeamId);
      }
    },
    onSuccess: () => invalidateMissionWorkflow(queryClient),
    onError: () => {
      notify.error(t('messagingHub.quote.decisionFailed', 'L’action a échoué, réessayez.'));
      void invalidateMissionWorkflow(queryClient);
    },
  });
}
