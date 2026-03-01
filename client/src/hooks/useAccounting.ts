import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { accountingApi } from '../services/api/accountingApi';
import type { PayoutStatus, ChannelCommission } from '../services/api/accountingApi';

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const accountingKeys = {
  payouts: ['accounting-payouts'] as const,
  commissions: ['accounting-commissions'] as const,
};

// ─── Hooks ──────────────────────────────────────────────────────────────────

export function usePayouts(ownerId?: number, status?: PayoutStatus) {
  return useQuery({
    queryKey: [...accountingKeys.payouts, ownerId, status] as const,
    queryFn: () => accountingApi.getPayouts(ownerId, status),
    staleTime: 60_000,
  });
}

export function useGeneratePayout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ownerId, from, to }: { ownerId: number; from: string; to: string }) =>
      accountingApi.generatePayout(ownerId, from, to),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountingKeys.payouts });
    },
  });
}

export function useApprovePayout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => accountingApi.approvePayout(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountingKeys.payouts });
    },
  });
}

export function useMarkAsPaid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, paymentReference }: { id: number; paymentReference: string }) =>
      accountingApi.markAsPaid(id, paymentReference),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountingKeys.payouts });
    },
  });
}

export function useCommissions() {
  return useQuery({
    queryKey: accountingKeys.commissions,
    queryFn: () => accountingApi.getCommissions(),
    staleTime: 120_000,
  });
}

export function useSaveCommission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ channel, data }: { channel: string; data: ChannelCommission }) =>
      accountingApi.saveCommission(channel, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountingKeys.commissions });
    },
  });
}
