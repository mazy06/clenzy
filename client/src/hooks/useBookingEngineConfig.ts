import { useMutation, useQueryClient } from '@tanstack/react-query';
import { bookingEngineApi } from '../services/api/bookingEngineApi';

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const bookingEngineKeys = {
  all: ['booking-engine'] as const,
  configs: ['booking-engine', 'configs'] as const,
  allConfigs: ['booking-engine', 'configs', 'all'] as const,
  configById: (id: number) => ['booking-engine', 'configs', id] as const,
  status: ['booking-engine-status'] as const,
};

// ─── AI Design Analysis ──────────────────────────────────────────────────────

/** Analyze a website and extract design tokens + generate matching CSS. */
export function useAnalyzeWebsiteDesign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ configId, websiteUrl }: { configId: number; websiteUrl: string }) =>
      bookingEngineApi.analyzeWebsite(configId, websiteUrl),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: bookingEngineKeys.configById(variables.configId) });
    },
  });
}
