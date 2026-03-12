import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { taxRulesApi } from '../services/api/taxRulesApi';
import type { TaxRuleRequest } from '../services/api/taxRulesApi';

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const taxRulesKeys = {
  all: ['tax-rules'] as const,
  byCountry: (code: string) => ['tax-rules', code] as const,
};

// ─── Hooks ───────────────────────────────────────────────────────────────────

export function useTaxRules(countryCode?: string) {
  return useQuery({
    queryKey: countryCode ? taxRulesKeys.byCountry(countryCode) : taxRulesKeys.all,
    queryFn: () => countryCode ? taxRulesApi.getForCountry(countryCode) : taxRulesApi.getAll(),
    staleTime: 60_000,
    retry: 1,
    retryDelay: 1_000,
  });
}

export function useCreateTaxRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: TaxRuleRequest) => taxRulesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taxRulesKeys.all });
    },
  });
}

export function useUpdateTaxRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: TaxRuleRequest }) => taxRulesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taxRulesKeys.all });
    },
  });
}

export function useDeleteTaxRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => taxRulesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taxRulesKeys.all });
    },
  });
}
