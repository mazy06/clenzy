import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { paymentsApi, type CreatePaymentSessionRequest } from '@/api/endpoints/paymentsApi';

const KEYS = {
  all: ['payments'] as const,
  history: (params?: Record<string, string>) => [...KEYS.all, 'history', params] as const,
  summary: () => [...KEYS.all, 'summary'] as const,
  sessionStatus: (sessionId: string) => [...KEYS.all, 'session-status', sessionId] as const,
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

export function useCreatePaymentSession() {
  return useMutation({
    mutationFn: (request: CreatePaymentSessionRequest) => paymentsApi.createSession(request),
  });
}

export function usePaymentSessionStatus(sessionId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: KEYS.sessionStatus(sessionId ?? ''),
    queryFn: () => paymentsApi.getSessionStatus(sessionId!),
    enabled: enabled && !!sessionId,
    refetchInterval: (query) => {
      const status = query.state.data?.paymentStatus;
      // Stop polling once we have a terminal status
      if (status === 'PAID' || status === 'FAILED' || status === 'CANCELLED' || status === 'REFUNDED') {
        return false;
      }
      return 2000; // Poll every 2s
    },
  });
}

export function useInvalidatePayments() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: KEYS.all });
    queryClient.invalidateQueries({ queryKey: ['interventions'] });
  };
}
