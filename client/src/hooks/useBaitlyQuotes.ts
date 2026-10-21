import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../services/apiClient';
import { serviceQuotesApi } from '../services/api/serviceQuotesApi';
import { quoteRequestsApi } from '../services/api/quoteRequestsApi';
import { invalidateMissionWorkflow } from './invalidateMissionWorkflow';

export type BaitlyQuoteView = 'ALL' | 'DECIDE' | 'WAITING' | 'ACCEPTED' | 'CLOSED';
export interface BaitlyQuoteEntry {
  key: string; quoteId: number | null; requestId: number | null; serviceRequestId: number | null;
  interventionId: number | null; title: string | null; propertyName: string | null; providerName: string | null;
  status: string; stage: BaitlyQuoteView; originalAmount: number | null; agreedAmount: number | null;
  currency: string | null; validUntil: string | null; createdAt: string; documentGenerationId: number | null;
  canDecide: boolean; canWithdraw: boolean; customerSide: boolean; expired: boolean; discussionUrl: string | null;
}
export interface BaitlyQuotePage { items: BaitlyQuoteEntry[]; page: number; size: number; totalElements: number; totalPages: number }

export function useBaitlyQuotes(view: BaitlyQuoteView, page: number, size = 20) {
  const { user, loading } = useAuth();
  return useQuery({
    queryKey: ['service-quotes', 'inbox', view, page, size, user?.id, user?.organizationId],
    queryFn: () => apiClient.get<BaitlyQuotePage>('/quotes', { params: { view, page, size } }),
    enabled: !!user && !loading,
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
}

export function useBaitlyQuoteDecision() {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: ({ entry, action, reason }: { entry: BaitlyQuoteEntry; action: 'accept' | 'decline' | 'withdraw'; reason?: string }): Promise<unknown> => {
      if (action === 'withdraw' && entry.canWithdraw && entry.requestId != null) return quoteRequestsApi.withdraw(entry.requestId, reason);
      if (!entry.canDecide || entry.expired) throw new Error('QUOTE_DECISION_UNAVAILABLE');
      if (entry.requestId != null) return action === 'accept' ? quoteRequestsApi.accept(entry.requestId) : quoteRequestsApi.decline(entry.requestId, reason);
      if (entry.quoteId == null || action === 'withdraw') throw new Error('QUOTE_DECISION_UNAVAILABLE');
      return action === 'accept' ? serviceQuotesApi.approve(entry.quoteId) : serviceQuotesApi.reject(entry.quoteId);
    },
    onSuccess: () => invalidateMissionWorkflow(cache),
    onError: () => { void invalidateMissionWorkflow(cache); },
  });
}
