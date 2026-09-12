import { useQuery } from '@tanstack/react-query';
import { smartLockApi, type SmartLockAccessCodeHistoryDto } from '../../services/api/smartLockApi';

/** Clé de cache — exportée pour l'invalidation après une rotation. */
export const lockAccessCodesKey = (deviceId: number) => ['lock-access-codes', deviceId] as const;

/**
 * État complet des codes d'une serrure.
 *
 * <p>Remplace `useLockAccessCode` partout où l'écran doit dire POURQUOI il n'y a
 * pas de code : l'ancien endpoint répond 204 sans distinguer « aucun séjour en
 * cours » (normal), « génération en échec » (à corriger) et « code révoqué au
 * départ » (trace). Même nombre de requêtes — celle-ci renvoie aussi le code en
 * vigueur.</p>
 */
export function useLockAccessCodeHistory(deviceId: number, enabled: boolean) {
  return useQuery({
    queryKey: lockAccessCodesKey(deviceId),
    queryFn: (): Promise<SmartLockAccessCodeHistoryDto> => smartLockApi.getAccessCodeHistory(deviceId),
    enabled,
    staleTime: 30_000,
  });
}
