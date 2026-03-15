import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { accountingApi } from '../services/api/accountingApi';
import type { UpdateSepaRequest, UpdateMethodRequest } from '../services/api/accountingApi';

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const ownerPayoutConfigKeys = {
  all: ['owner-payout-config'] as const,
  me: ['owner-payout-config', 'me'] as const,
  byOwner: (ownerId: number) => [...ownerPayoutConfigKeys.all, ownerId] as const,
};

// ─── Hooks ──────────────────────────────────────────────────────────────────

export function useOwnerPayoutConfig(ownerId: number | undefined) {
  return useQuery({
    queryKey: ownerPayoutConfigKeys.byOwner(ownerId!),
    queryFn: () => accountingApi.getOwnerPayoutConfig(ownerId!),
    enabled: !!ownerId,
    staleTime: 60_000,
  });
}

export function useAllOwnerPayoutConfigs() {
  return useQuery({
    queryKey: ownerPayoutConfigKeys.all,
    queryFn: () => accountingApi.getAllOwnerPayoutConfigs(),
    staleTime: 60_000,
  });
}

export function useUpdatePayoutMethod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ownerId, data }: { ownerId: number; data: UpdateMethodRequest }) =>
      accountingApi.updatePayoutMethod(ownerId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ownerPayoutConfigKeys.all });
    },
  });
}

export function useUpdateSepaDetails() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ownerId, data }: { ownerId: number; data: UpdateSepaRequest }) =>
      accountingApi.updateSepaDetails(ownerId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ownerPayoutConfigKeys.all });
    },
  });
}

export function useVerifyOwnerConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ownerId: number) => accountingApi.verifyOwnerConfig(ownerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ownerPayoutConfigKeys.all });
    },
  });
}

// ─── Self-service hooks (current user) ──────────────────────────────────────

export function useMyPayoutConfig() {
  return useQuery({
    queryKey: ownerPayoutConfigKeys.me,
    queryFn: () => accountingApi.getMyPayoutConfig(),
    staleTime: 60_000,
  });
}

export function useUpdateMySepa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateSepaRequest) => accountingApi.updateMySepa(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ownerPayoutConfigKeys.me });
    },
  });
}

export function useInitMyStripeConnect() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => accountingApi.initMyStripeConnect(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ownerPayoutConfigKeys.me });
    },
  });
}

export function useMyStripeOnboardingLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => accountingApi.getMyStripeOnboardingLink(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ownerPayoutConfigKeys.me });
    },
  });
}
