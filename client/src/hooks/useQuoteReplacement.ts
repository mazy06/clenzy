import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../services/apiClient';

export interface QuoteReplacementContext {
  quoteId: number; propertyId: number | null; title: string; categoryCode: string | null;
  serviceItemCode: string | null; desiredDate: string | null; activeRequestId: number | null;
  startTime: string | null; durationMinutes: number | null;
  requiresServiceSelection?: boolean;
}

export function useQuoteReplacement(id?: string | null) {
  const { user, loading } = useAuth();
  const valid = !!id && /^[1-9]\d*$/.test(id) && Number.isSafeInteger(Number(id));
  return useQuery({
    queryKey: ['service-quotes', id, 'replacement', user?.id, user?.organizationId],
    queryFn: () => {
      if (!valid) throw new Error('Invalid replacement reference');
      return apiClient.get<QuoteReplacementContext>(`/service-quotes/${id}/replacement`);
    },
    enabled: !!id && !!user && !loading,
    retry: false, refetchInterval: 15_000,
  });
}
