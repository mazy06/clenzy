import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bookingEngineApi } from '../services/api/bookingEngineApi';
import type { BookingEngineConfigUpdate, DesignTokens } from '../services/api/bookingEngineApi';

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const bookingEngineKeys = {
  all: ['booking-engine'] as const,
  configs: ['booking-engine', 'configs'] as const,
  configById: (id: number) => ['booking-engine', 'configs', id] as const,
  status: ['booking-engine-status'] as const,
};

// ─── Hooks ──────────────────────────────────────────────────────────────────

/** List all templates for the current org. */
export function useBookingEngineConfigs() {
  return useQuery({
    queryKey: bookingEngineKeys.configs,
    queryFn: () => bookingEngineApi.listConfigs(),
    staleTime: 60_000,
    retry: 1,
    retryDelay: 1_000,
  });
}

/** Get a single template by ID. */
export function useBookingEngineConfigById(id: number | null) {
  return useQuery({
    queryKey: bookingEngineKeys.configById(id!),
    queryFn: () => bookingEngineApi.getConfigById(id!),
    enabled: id != null,
    staleTime: 60_000,
    retry: 1,
    retryDelay: 1_000,
  });
}

/** Legacy: get the first/default config. */
export function useBookingEngineConfig() {
  return useQuery({
    queryKey: [...bookingEngineKeys.all, 'legacy'],
    queryFn: () => bookingEngineApi.getConfig(),
    staleTime: 60_000,
    retry: 1,
    retryDelay: 1_000,
  });
}

/** Create a new template. */
export function useCreateBookingEngineConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: BookingEngineConfigUpdate) => bookingEngineApi.createConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bookingEngineKeys.configs });
      queryClient.invalidateQueries({ queryKey: bookingEngineKeys.status });
    },
  });
}

/** Update an existing template. */
export function useUpdateBookingEngineConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: BookingEngineConfigUpdate }) =>
      bookingEngineApi.updateConfig(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: bookingEngineKeys.configs });
      queryClient.invalidateQueries({ queryKey: bookingEngineKeys.configById(variables.id) });
      queryClient.invalidateQueries({ queryKey: bookingEngineKeys.status });
    },
  });
}

/** Delete a template. */
export function useDeleteBookingEngineConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => bookingEngineApi.deleteConfig(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bookingEngineKeys.configs });
      queryClient.invalidateQueries({ queryKey: bookingEngineKeys.status });
    },
  });
}

/** Toggle a template on/off. */
export function useToggleBookingEngine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      bookingEngineApi.toggleEnabled(id, enabled),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: bookingEngineKeys.configs });
      queryClient.invalidateQueries({ queryKey: bookingEngineKeys.configById(variables.id) });
      queryClient.invalidateQueries({ queryKey: bookingEngineKeys.status });
    },
  });
}

/** Regenerate API key for a template. */
export function useRegenerateApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => bookingEngineApi.regenerateApiKey(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: bookingEngineKeys.configs });
      if (data?.id) {
        queryClient.invalidateQueries({ queryKey: bookingEngineKeys.configById(data.id) });
      }
      queryClient.invalidateQueries({ queryKey: bookingEngineKeys.status });
    },
  });
}

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

/** Regenerate CSS from edited design tokens. */
export function useGenerateCssFromTokens() {
  return useMutation({
    mutationFn: ({
      configId,
      designTokens,
      additionalInstructions,
    }: {
      configId: number;
      designTokens: DesignTokens;
      additionalInstructions?: string;
    }) => bookingEngineApi.generateCss(configId, designTokens, additionalInstructions),
  });
}
