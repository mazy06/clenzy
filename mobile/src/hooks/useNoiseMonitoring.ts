import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { noiseApi, type NoiseChartData, type NoiseAlertPage, type NoiseAlertDto, type NoiseDeviceDto } from '@/api/endpoints/noiseApi';

const KEYS = {
  chartData: ['noise-chart-data'] as const,
  alerts: ['noise-alerts'] as const,
  unacknowledgedCount: ['noise-unacknowledged-count'] as const,
  devices: ['noise-devices'] as const,
};

/** Fetch all noise devices (org-scoped). Refetch every 60s. */
export function useNoiseDevices() {
  return useQuery<NoiseDeviceDto[]>({
    queryKey: KEYS.devices,
    queryFn: () => noiseApi.getDevices(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

/** Fetch aggregated noise data (device summaries + chart points). Refetch every 60s. */
export function useNoiseChartData() {
  return useQuery<NoiseChartData>({
    queryKey: KEYS.chartData,
    queryFn: () => noiseApi.getChartData(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

/** Fetch noise alert history (paginated) */
export function useNoiseAlerts(params?: { propertyId?: number; severity?: string; page?: number; size?: number }) {
  return useQuery<NoiseAlertPage>({
    queryKey: [...KEYS.alerts, params],
    queryFn: () => noiseApi.getAlerts(params),
  });
}

/** Poll unacknowledged alert count every 30s */
export function useUnacknowledgedAlertCount() {
  return useQuery<{ count: number }>({
    queryKey: KEYS.unacknowledgedCount,
    queryFn: () => noiseApi.getUnacknowledgedCount(),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}

/** Acknowledge an alert (optimistic update) */
export function useAcknowledgeAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, notes }: { id: number; notes?: string }) =>
      noiseApi.acknowledgeAlert(id, notes),

    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: KEYS.alerts });
      await queryClient.cancelQueries({ queryKey: KEYS.unacknowledgedCount });

      // Optimistically mark alert as acknowledged in all cached alert pages
      const previousAlerts = queryClient.getQueriesData<NoiseAlertPage>({ queryKey: KEYS.alerts });
      const previousCount = queryClient.getQueryData<{ count: number }>(KEYS.unacknowledgedCount);

      queryClient.setQueriesData<NoiseAlertPage>({ queryKey: KEYS.alerts }, (old) => {
        if (!old) return old;
        return {
          ...old,
          content: old.content.map((a) =>
            a.id === id ? { ...a, acknowledged: true } : a,
          ),
        };
      });

      if (previousCount && previousCount.count > 0) {
        queryClient.setQueryData(KEYS.unacknowledgedCount, { count: previousCount.count - 1 });
      }

      return { previousAlerts, previousCount };
    },

    onError: (_err, _vars, context) => {
      // Rollback
      if (context?.previousAlerts) {
        for (const [key, data] of context.previousAlerts) {
          queryClient.setQueryData(key, data);
        }
      }
      if (context?.previousCount) {
        queryClient.setQueryData(KEYS.unacknowledgedCount, context.previousCount);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.alerts });
      queryClient.invalidateQueries({ queryKey: KEYS.unacknowledgedCount });
    },
  });
}
