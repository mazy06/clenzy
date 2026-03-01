import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  noiseAlertConfigApi,
  type NoiseAlertConfigDto,
  type SaveNoiseAlertConfigRequest,
} from '@/api/endpoints/noiseAlertConfigApi';

const KEYS = {
  all: ['noise-alert-config'] as const,
  byProperty: (propertyId: number) => ['noise-alert-config', propertyId] as const,
};

/** Fetch all noise alert configs for the organization */
export function useNoiseAlertConfigs() {
  return useQuery<NoiseAlertConfigDto[]>({
    queryKey: KEYS.all,
    queryFn: () => noiseAlertConfigApi.getAll(),
    staleTime: 60_000,
  });
}

/** Fetch noise alert config for a specific property */
export function useNoiseAlertConfig(propertyId: number) {
  return useQuery<NoiseAlertConfigDto | null>({
    queryKey: KEYS.byProperty(propertyId),
    queryFn: async () => {
      try {
        return await noiseAlertConfigApi.getByProperty(propertyId);
      } catch (error: any) {
        // 404 = no config yet, return null
        if (error?.response?.status === 404) return null;
        throw error;
      }
    },
    staleTime: 30_000,
    enabled: propertyId > 0,
  });
}

/** Create or update noise alert config (PUT) */
export function useSaveNoiseAlertConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ propertyId, data }: { propertyId: number; data: SaveNoiseAlertConfigRequest }) =>
      noiseAlertConfigApi.save(propertyId, data),

    onSuccess: (_result, { propertyId }) => {
      queryClient.invalidateQueries({ queryKey: KEYS.all });
      queryClient.invalidateQueries({ queryKey: KEYS.byProperty(propertyId) });
    },
  });
}
