import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { receivedFormsApi } from '../services/api/receivedFormsApi';

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const receivedFormsKeys = {
  all: ['received-forms'] as const,
  list: (params: { page?: number; size?: number; type?: string }) =>
    [...receivedFormsKeys.all, 'list', params] as const,
  stats: () => [...receivedFormsKeys.all, 'stats'] as const,
};

// ─── Queries ────────────────────────────────────────────────────────────────

export function useReceivedForms(params: { page?: number; size?: number; type?: string } = {}) {
  return useQuery({
    queryKey: receivedFormsKeys.list(params),
    queryFn: () => receivedFormsApi.list(params),
    staleTime: 30_000,
  });
}

export function useFormsStats(enabled = true) {
  return useQuery({
    queryKey: receivedFormsKeys.stats(),
    queryFn: () => receivedFormsApi.getStats(),
    staleTime: 60_000,
    enabled,
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────

export function useUpdateFormStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      receivedFormsApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: receivedFormsKeys.all });
    },
  });
}

export function useResetFormsAvailability() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => {
      receivedFormsApi.resetAvailability();
      return Promise.resolve();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: receivedFormsKeys.all });
    },
  });
}
