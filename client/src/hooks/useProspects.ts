import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { prospectsApi } from '../services/api/prospectsApi';
import type { ProspectDto } from '../services/api/prospectsApi';

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const prospectsKeys = {
  all: ['prospects'] as const,
  list: () => [...prospectsKeys.all, 'list'] as const,
};

// ─── Queries ────────────────────────────────────────────────────────────────

export function useProspects() {
  return useQuery({
    queryKey: prospectsKeys.list(),
    queryFn: () => prospectsApi.getAll(),
    staleTime: 60_000,
  });
}

// ─── Mutations ──────────────────────────────────────────────────────────────

export function useImportProspects() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, category }: { file: File; category: string }) =>
      prospectsApi.importCsv(file, category),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: prospectsKeys.all });
    },
  });
}

export function useUpdateProspect() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ProspectDto> }) =>
      prospectsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: prospectsKeys.all });
    },
  });
}

export function useDeleteProspect() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => prospectsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: prospectsKeys.all });
    },
  });
}
