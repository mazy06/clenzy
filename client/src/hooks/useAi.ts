import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { aiApi } from '../services/api/aiApi';
import type { SaveAiApiKeyRequest } from '../services/api/aiApi';

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const aiKeys = {
  all: ['ai'] as const,
  usageStats: () => [...aiKeys.all, 'usage-stats'] as const,
  pricingPredictions: (propertyId: number, from: string, to: string) =>
    [...aiKeys.all, 'pricing-predictions', propertyId, from, to] as const,
  insights: (propertyId: number, from: string, to: string) =>
    [...aiKeys.all, 'insights', propertyId, from, to] as const,
  keyStatus: () => [...aiKeys.all, 'key-status'] as const,
  featureToggles: () => [...aiKeys.all, 'feature-toggles'] as const,
};

// ─── Usage Stats ────────────────────────────────────────────────────────────

export function useAiUsageStats() {
  return useQuery({
    queryKey: aiKeys.usageStats(),
    queryFn: () => aiApi.getUsageStats(),
    staleTime: 5 * 60_000, // 5 minutes
  });
}

// ─── Pricing Predictions ────────────────────────────────────────────────────

export function useAiPricingPredictions(
  propertyId: number,
  from: string,
  to: string,
  enabled = true,
) {
  return useQuery({
    queryKey: aiKeys.pricingPredictions(propertyId, from, to),
    queryFn: () => aiApi.getPricingPredictions(propertyId, from, to),
    enabled: enabled && propertyId > 0 && !!from && !!to,
    staleTime: 10 * 60_000, // 10 minutes
  });
}

// ─── Messaging AI ───────────────────────────────────────────────────────────

export function useAiDetectIntent() {
  return useMutation({
    mutationFn: (message: string) => aiApi.detectIntent(message),
  });
}

export function useAiSuggestResponse() {
  return useMutation({
    mutationFn: ({
      message,
      context,
      language,
    }: {
      message: string;
      context?: string;
      language?: string;
    }) => aiApi.suggestResponse(message, context, language),
  });
}

// ─── Analytics Insights ─────────────────────────────────────────────────────

export function useAiInsights(
  propertyId: number,
  from: string,
  to: string,
  enabled = true,
) {
  return useQuery({
    queryKey: aiKeys.insights(propertyId, from, to),
    queryFn: () => aiApi.getInsights(propertyId, from, to),
    enabled: enabled && propertyId > 0 && !!from && !!to,
    staleTime: 10 * 60_000,
  });
}

// ─── Sentiment Analysis ─────────────────────────────────────────────────────

export function useAiSentimentAnalysis() {
  return useMutation({
    mutationFn: ({ text, language }: { text: string; language?: string }) =>
      aiApi.analyzeSentiment(text, language),
  });
}

// ─── Feature Toggles ─────────────────────────────────────────────────────────

export function useAiFeatureToggles() {
  return useQuery({
    queryKey: aiKeys.featureToggles(),
    queryFn: () => aiApi.getFeatureToggles(),
    staleTime: 2 * 60_000, // 2 minutes
  });
}

/**
 * Vérifie si une feature IA est activée.
 * Renvoie `true` par défaut (backward compatible) ou pendant le chargement.
 */
export function useIsAiFeatureEnabled(feature: string): boolean {
  const { data: toggles } = useAiFeatureToggles();
  if (!toggles) return true;
  const toggle = toggles.find(t => t.feature === feature);
  return toggle?.enabled ?? true;
}

export function useSetAiFeatureToggle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ feature, enabled }: { feature: string; enabled: boolean }) =>
      aiApi.setFeatureToggle(feature, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: aiKeys.featureToggles() });
    },
  });
}

// ─── Key Management (BYOK) ─────────────────────────────────────────────────

export function useAiKeyStatus() {
  return useQuery({
    queryKey: aiKeys.keyStatus(),
    queryFn: () => aiApi.getKeyStatus(),
    staleTime: 2 * 60_000, // 2 minutes
  });
}

export function useTestAiKey() {
  return useMutation({
    mutationFn: (data: SaveAiApiKeyRequest) => aiApi.testKey(data),
  });
}

export function useSaveAiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SaveAiApiKeyRequest) => aiApi.saveKey(data),
    onSuccess: () => {
      // Invalidate ALL ai queries (key status + usage stats + pricing + analytics)
      // so widgets refresh after a key change instead of showing stale errors
      queryClient.invalidateQueries({ queryKey: aiKeys.all });
    },
  });
}

export function useDeleteAiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (provider: string) => aiApi.deleteKey(provider),
    onSuccess: () => {
      // Invalidate ALL ai queries so widgets refetch after key deletion
      queryClient.invalidateQueries({ queryKey: aiKeys.all });
    },
  });
}
