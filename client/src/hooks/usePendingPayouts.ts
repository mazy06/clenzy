import { useQuery } from '@tanstack/react-query';
import { accountingApi } from '../services/api/accountingApi';

const PENDING_KEY = ['pending-payouts'] as const;

export function usePendingPayouts() {
  return useQuery({
    queryKey: PENDING_KEY,
    queryFn: () => accountingApi.getPendingPayoutCount(),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
}
