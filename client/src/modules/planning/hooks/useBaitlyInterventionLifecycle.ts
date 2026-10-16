import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { interventionsApi } from '../../../services/api/interventionsApi';
import { planningKeys } from './usePlanningData';

/** Actions de terrain Baitly : une seule gestion d'erreur et de rafraîchissement. */
export function useBaitlyInterventionLifecycle() {
  const queryClient = useQueryClient();
  const run = useCallback(async (action: () => Promise<unknown>) => {
    try {
      await action();
      void queryClient.invalidateQueries({ queryKey: planningKeys.all });
      return { success: true, error: null };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erreur lors de la mise à jour.' };
    }
  }, [queryClient]);
  const startIntervention = useCallback((id: number) => run(() => interventionsApi.start(id)), [run]);
  const completeIntervention = useCallback((id: number) => run(() => interventionsApi.updateProgress(id, 100)), [run]);
  const validateIntervention = useCallback((id: number, estimatedCost: number) =>
    run(() => interventionsApi.update(id, { estimatedCost, status: 'COMPLETED' })), [run]);
  const uploadPhotos = useCallback((id: number, photos: File[], type: 'before' | 'after') =>
    run(() => interventionsApi.uploadPhotos(id, photos, type)), [run]);
  const updateInterventionProgress = useCallback((id: number, progress: number) =>
    run(() => interventionsApi.updateProgress(id, progress)), [run]);
  return { startIntervention, completeIntervention, validateIntervention, uploadPhotos, updateInterventionProgress };
}
