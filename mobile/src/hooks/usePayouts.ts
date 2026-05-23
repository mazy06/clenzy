/**
 * Hooks React Query pour les payouts (reversements proprietaires).
 *
 * Voir `payoutsApi.ts` pour les endpoints sous-jacents.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  payoutsApi,
  type PayoutListParams,
  type GeneratePayoutRequest,
  type GenerateBatchRequest,
  type MarkAsPaidRequest,
  type SendStatementRequest,
} from '@/api/endpoints/payoutsApi';
import { ownerPayoutConfigApi } from '@/api/endpoints/ownerPayoutConfigApi';

const KEYS = {
  all: ['payouts'] as const,
  list: (params?: PayoutListParams) => [...KEYS.all, 'list', params] as const,
  detail: (id: number) => [...KEYS.all, 'detail', id] as const,
  pendingSummary: () => [...KEYS.all, 'pending-summary'] as const,
  myPendingSummary: () => [...KEYS.all, 'my-pending-summary'] as const,
};

export function usePayouts(params?: PayoutListParams) {
  return useQuery({
    queryKey: KEYS.list(params),
    queryFn: () => payoutsApi.list(params),
  });
}

export function usePayout(id: number, enabled = true) {
  return useQuery({
    queryKey: KEYS.detail(id),
    queryFn: () => payoutsApi.get(id),
    enabled: enabled && id > 0,
  });
}

export function usePendingPayoutSummary() {
  return useQuery({
    queryKey: KEYS.pendingSummary(),
    queryFn: () => payoutsApi.pendingSummary(),
    refetchInterval: 60_000, // refresh toutes les minutes (dashboard widget)
  });
}

export function useMyPendingPayoutSummary() {
  return useQuery({
    queryKey: KEYS.myPendingSummary(),
    queryFn: () => payoutsApi.myPendingSummary(),
    refetchInterval: 60_000,
  });
}

export function useGeneratePayout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: GeneratePayoutRequest) => payoutsApi.generate(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}

export function useGeneratePayoutsBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: GenerateBatchRequest) => payoutsApi.generateBatch(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.all });
    },
  });
}

export function useApprovePayout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => payoutsApi.approve(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: KEYS.all });
      queryClient.invalidateQueries({ queryKey: KEYS.detail(id) });
    },
  });
}

export function useMarkPayoutAsPaid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: number; request: MarkAsPaidRequest }) =>
      payoutsApi.markAsPaid(args.id, args.request),
    onSuccess: (_data, args) => {
      queryClient.invalidateQueries({ queryKey: KEYS.all });
      queryClient.invalidateQueries({ queryKey: KEYS.detail(args.id) });
    },
  });
}

export function useExecutePayout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => payoutsApi.execute(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: KEYS.all });
      queryClient.invalidateQueries({ queryKey: KEYS.detail(id) });
    },
  });
}

export function useRetryPayout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => payoutsApi.retry(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: KEYS.all });
      queryClient.invalidateQueries({ queryKey: KEYS.detail(id) });
    },
  });
}

export function useSendOwnerStatement() {
  return useMutation({
    mutationFn: (request: SendStatementRequest) => payoutsApi.sendStatement(request),
  });
}

export function useOwnerPayoutConfig(ownerId: number | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ['owner-payout-config', ownerId],
    queryFn: () => ownerPayoutConfigApi.getConfig(ownerId!),
    enabled: enabled && !!ownerId && ownerId > 0,
    // Configuration banc — change rarement, on cache 5 min
    staleTime: 5 * 60 * 1000,
  });
}

export function useInvalidatePayouts() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: KEYS.all });
  };
}
