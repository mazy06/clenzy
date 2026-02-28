import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fiscalProfileApi } from '../services/api/fiscalProfileApi';
import type { FiscalProfileUpdate } from '../services/api/fiscalProfileApi';

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const fiscalProfileKeys = {
  all: ['fiscal-profile'] as const,
};

// ─── Hooks ──────────────────────────────────────────────────────────────────

export function useFiscalProfile() {
  return useQuery({
    queryKey: fiscalProfileKeys.all,
    queryFn: () => fiscalProfileApi.get(),
    staleTime: 60_000,
    retry: 1,           // Only 1 retry — fast feedback
    retryDelay: 1_000,
  });
}

export function useUpdateFiscalProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: FiscalProfileUpdate) => fiscalProfileApi.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: fiscalProfileKeys.all });
    },
  });
}
