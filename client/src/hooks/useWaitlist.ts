import { useQuery } from '@tanstack/react-query';
import { waitlistApi } from '../services/api/waitlistApi';

export function useWaitlistStats(enabled = true) {
  return useQuery({
    queryKey: ['waitlist', 'stats'],
    queryFn: () => waitlistApi.stats(),
    staleTime: 60_000,
    enabled,
  });
}

export function useWaitlistList(enabled = true) {
  return useQuery({
    queryKey: ['waitlist', 'list'],
    queryFn: () => waitlistApi.list(),
    staleTime: 60_000,
    enabled,
  });
}
