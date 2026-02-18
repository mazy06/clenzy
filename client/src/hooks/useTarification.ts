import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { pricingConfigApi } from '../services/api/pricingConfigApi';
import type { PricingConfig, PricingConfigUpdate } from '../services/api/pricingConfigApi';
import { teamsApi } from '../services/api/teamsApi';
import type { Team } from '../services/api/teamsApi';
import { useAuth } from './useAuth';
import { useTranslation } from './useTranslation';

// ============================================================================
// Query keys
// ============================================================================

export const tarificationKeys = {
  all: ['tarification'] as const,
  config: () => [...tarificationKeys.all, 'config'] as const,
  teams: () => [...tarificationKeys.all, 'teams'] as const,
};

// ============================================================================
// Default config (empty arrays — real data is seeded in DB via V36 migration)
// ============================================================================

const DEFAULT_CONFIG: PricingConfig = {
  id: null,
  propertyTypeCoeffs: { studio: 0.85, appartement: 1.0, maison: 1.15, duplex: 1.20, villa: 1.35, autre: 1.0 },
  propertyCountCoeffs: { '1': 1.0, '2': 0.95, '3-5': 0.90, '6+': 0.85 },
  guestCapacityCoeffs: { '1-2': 0.90, '3-4': 1.0, '5-6': 1.10, '7+': 1.25 },
  frequencyCoeffs: { 'tres-frequent': 0.85, regulier: 0.92, 'nouvelle-annonce': 1.0, occasionnel: 1.10 },
  surfaceTiers: [
    { maxSurface: 40, coeff: 0.85, label: '< 40 m²' },
    { maxSurface: 60, coeff: 1.0, label: '40 - 60 m²' },
    { maxSurface: 80, coeff: 1.10, label: '61 - 80 m²' },
    { maxSurface: 120, coeff: 1.20, label: '81 - 120 m²' },
    { maxSurface: null, coeff: 1.35, label: '> 120 m²' },
  ],
  basePriceEssentiel: 50,
  basePriceConfort: 75,
  basePricePremium: 100,
  minPrice: 50,
  pmsMonthlyPriceCents: 500,
  pmsSyncPriceCents: 1000,
  automationBasicSurcharge: 0,
  automationFullSurcharge: 0,
  forfaitConfigs: [],
  travauxConfig: [],
  exterieurConfig: [],
  blanchisserieConfig: [],
  commissionConfigs: [],
  availablePrestations: [],
  availableSurcharges: [],
  updatedAt: null,
};

// ============================================================================
// Hook
// ============================================================================

export interface UseTarificationReturn {
  config: PricingConfig;
  teams: Team[];
  isLoading: boolean;
  isError: boolean;
  error: string | null;
  canEdit: boolean;
  isSaving: boolean;
  updateConfig: (partial: Partial<PricingConfig>) => void;
  saveConfig: () => void;
  resetConfig: () => void;
  snackbar: { open: boolean; message: string; severity: 'success' | 'error' };
  closeSnackbar: () => void;
}

export function useTarification(): UseTarificationReturn {
  const { hasPermissionAsync } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // ─── Permission ─────────────────────────────────────────────────────
  const [canEdit, setCanEdit] = useState(false);
  useEffect(() => {
    hasPermissionAsync('tarification:edit').then(setCanEdit);
  }, [hasPermissionAsync]);

  // ─── Snackbar ───────────────────────────────────────────────────────
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });
  const closeSnackbar = useCallback(() => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  }, []);

  // ─── Queries ────────────────────────────────────────────────────────
  const configQuery = useQuery({
    queryKey: tarificationKeys.config(),
    queryFn: () => pricingConfigApi.get(),
    staleTime: 120_000,
  });

  const teamsQuery = useQuery({
    queryKey: tarificationKeys.teams(),
    queryFn: () => teamsApi.getAll().catch(() => [] as Team[]),
    staleTime: 120_000,
  });

  // ─── Local editable state (initialized from query) ──────────────────
  const [config, setConfig] = useState<PricingConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    if (configQuery.data) {
      // Data comes directly from DB — no frontend fallbacks needed
      setConfig(configQuery.data);
    }
  }, [configQuery.data]);

  // ─── Mutation ───────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: (data: PricingConfigUpdate) => pricingConfigApi.update(data),
    onSuccess: (updated) => {
      // Update the cache directly with server response (avoids unnecessary refetch)
      queryClient.setQueryData(tarificationKeys.config(), updated);
      // Also invalidate to keep cache consistent across the app
      queryClient.invalidateQueries({ queryKey: tarificationKeys.all });
      setSnackbar({ open: true, message: t('tarification.saveSuccess'), severity: 'success' });
    },
    onError: () => {
      setSnackbar({ open: true, message: t('tarification.saveError'), severity: 'error' });
    },
  });

  // ─── Actions ────────────────────────────────────────────────────────
  const updateConfig = useCallback((partial: Partial<PricingConfig>) => {
    setConfig((prev) => ({ ...prev, ...partial }));
  }, []);

  const saveConfig = useCallback(() => {
    const { id, updatedAt, ...updateData } = config;
    saveMutation.mutate(updateData as PricingConfigUpdate);
  }, [config, saveMutation]);

  const resetConfig = useCallback(() => {
    if (window.confirm(t('tarification.resetConfirm'))) {
      if (configQuery.data) {
        setConfig(configQuery.data);
      }
    }
  }, [configQuery.data, t]);

  // ─── Return ─────────────────────────────────────────────────────────
  return useMemo(() => ({
    config,
    teams: teamsQuery.data ?? [],
    isLoading: configQuery.isLoading || teamsQuery.isLoading,
    isError: configQuery.isError,
    error: configQuery.error ? (configQuery.error as { message?: string }).message ?? 'Erreur de chargement' : null,
    canEdit,
    isSaving: saveMutation.isPending,
    updateConfig,
    saveConfig,
    resetConfig,
    snackbar,
    closeSnackbar,
  }), [
    config,
    teamsQuery.data,
    configQuery.isLoading,
    teamsQuery.isLoading,
    configQuery.isError,
    configQuery.error,
    canEdit,
    saveMutation.isPending,
    updateConfig,
    saveConfig,
    resetConfig,
    snackbar,
    closeSnackbar,
  ]);
}
