import { useQuery } from '@tanstack/react-query';
import { paymentsApi } from '@/api/endpoints/paymentsApi';

const KEYS = {
  all: ['payments'] as const,
  history: (params?: Record<string, string>) => [...KEYS.all, 'history', params] as const,
  summary: () => [...KEYS.all, 'summary'] as const,
};

export function usePaymentHistory(params?: Record<string, string>) {
  return useQuery({
    queryKey: KEYS.history(params),
    queryFn: () => paymentsApi.getHistory(params),
  });
}

export function usePaymentSummary() {
  return useQuery({
    queryKey: KEYS.summary(),
    queryFn: () => paymentsApi.getSummary(),
  });
}
