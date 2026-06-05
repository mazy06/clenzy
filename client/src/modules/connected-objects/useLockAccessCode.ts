import { useQuery } from '@tanstack/react-query';
import { smartLockApi, type SmartLockAccessCodeDto } from '../../services/api/smartLockApi';

/**
 * Code d'accès courant d'une serrure (null si aucun code actif). Le backend
 * renvoie 204 sans corps quand il n'y a pas de code → normalisé en null.
 */
export function useLockAccessCode(deviceId: number, enabled: boolean) {
  return useQuery({
    queryKey: ['lock-access-code', deviceId],
    queryFn: async (): Promise<SmartLockAccessCodeDto | null> => {
      const data = await smartLockApi.getAccessCode(deviceId);
      return data && typeof data === 'object' && (data as SmartLockAccessCodeDto).id
        ? (data as SmartLockAccessCodeDto)
        : null;
    },
    enabled,
    staleTime: 30_000,
  });
}
