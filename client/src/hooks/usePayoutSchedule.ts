import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { accountingApi } from '../services/api/accountingApi';
import type { UpdatePayoutScheduleRequest } from '../services/api/accountingApi';

const SCHEDULE_KEY = ['payout-schedule'] as const;

export function usePayoutSchedule() {
  return useQuery({
    queryKey: SCHEDULE_KEY,
    queryFn: () => accountingApi.getPayoutSchedule(),
    staleTime: 5 * 60_000,
  });
}

export function useUpdatePayoutSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdatePayoutScheduleRequest) =>
      accountingApi.updatePayoutSchedule(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SCHEDULE_KEY });
    },
  });
}
