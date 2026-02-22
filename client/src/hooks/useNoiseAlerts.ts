import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  noiseAlertConfigApi,
  noiseAlertsApi,
  type NoiseAlertConfigDto,
  type SaveNoiseAlertConfigDto,
  type NoiseAlertDto,
  type NoiseAlertPage,
} from '../services/api/noiseAlertApi';

// ─── Query Keys ──────────────────────────────────────────────────────────────

const KEYS = {
  configs: ['noise-alert-configs'] as const,
  config: (propertyId: number) => ['noise-alert-config', propertyId] as const,
  alerts: (params?: { propertyId?: number; severity?: string; page?: number }) =>
    ['noise-alerts', params] as const,
  unacknowledgedCount: ['noise-alerts-unacknowledged-count'] as const,
};

// ─── Config hooks ────────────────────────────────────────────────────────────

export function useNoiseAlertConfigs() {
  return useQuery({
    queryKey: KEYS.configs,
    queryFn: () => noiseAlertConfigApi.getAll(),
    staleTime: 60_000,
  });
}

export function useNoiseAlertConfig(propertyId: number | null) {
  return useQuery({
    queryKey: KEYS.config(propertyId!),
    queryFn: () => noiseAlertConfigApi.getByProperty(propertyId!),
    enabled: propertyId != null,
    staleTime: 60_000,
  });
}

export function useSaveNoiseAlertConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ propertyId, data }: { propertyId: number; data: SaveNoiseAlertConfigDto }) =>
      noiseAlertConfigApi.save(propertyId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: KEYS.configs });
      queryClient.invalidateQueries({ queryKey: KEYS.config(variables.propertyId) });
    },
  });
}

export function useDeleteNoiseAlertConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (propertyId: number) => noiseAlertConfigApi.delete(propertyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.configs });
    },
  });
}

// ─── Alerts hooks ────────────────────────────────────────────────────────────

export function useNoiseAlerts(params?: {
  propertyId?: number;
  severity?: string;
  page?: number;
  size?: number;
}) {
  return useQuery({
    queryKey: KEYS.alerts(params),
    queryFn: () => noiseAlertsApi.getAlerts(params),
    staleTime: 30_000,
  });
}

export function useUnacknowledgedAlertCount() {
  return useQuery({
    queryKey: KEYS.unacknowledgedCount,
    queryFn: async () => {
      const result = await noiseAlertsApi.getUnacknowledgedCount();
      return result.count;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useAcknowledgeAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, notes }: { id: number; notes?: string }) =>
      noiseAlertsApi.acknowledge(id, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['noise-alerts'] });
      queryClient.invalidateQueries({ queryKey: KEYS.unacknowledgedCount });
    },
  });
}

// ─── Types re-export ─────────────────────────────────────────────────────────

export type { NoiseAlertConfigDto, SaveNoiseAlertConfigDto, NoiseAlertDto, NoiseAlertPage };
