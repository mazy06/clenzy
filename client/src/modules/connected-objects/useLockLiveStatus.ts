import { useQuery, useQueryClient } from '@tanstack/react-query';
import { smartLockApi } from '../../services/api/smartLockApi';

/**
 * Rafraîchit UNE fois le statut live d'une serrure (online / verrou / batterie
 * réels via Tuya) au montage de sa carte. L'appel `GET /smart-locks/{id}/status`
 * persiste les valeurs côté backend ; au succès on invalide le read-model
 * `connected-objects` pour que la carte ET les KPIs reflètent le même état réel
 * (source unique = read-model). Pas de polling (staleTime 60s, refetch off) afin
 * de borner les appels Tuya aux serrures réellement affichées.
 */
export function useLockLiveStatus(deviceId: number, enabled: boolean) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: ['lock-status', deviceId],
    queryFn: async () => {
      const status = await smartLockApi.getStatus(deviceId);
      // Le statut a été persisté côté serveur → rafraîchit le read-model
      // (carte + KPIs cohérents, plus de « En ligne » vs « État inconnu »).
      await qc.invalidateQueries({ queryKey: ['connected-objects'] });
      return status;
    },
    enabled,
    staleTime: 60_000,
    refetchInterval: false,
    retry: false,
  });
}
