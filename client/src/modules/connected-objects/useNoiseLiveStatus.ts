import { useQuery, useQueryClient } from '@tanstack/react-query';
import { noiseDevicesApi } from '../../services/api/noiseApi';

/**
 * Mirror de {@link useLockLiveStatus} pour les capteurs de bruit : rafraîchit UNE
 * fois le online réel (flag Tuya/Minut) au montage de la carte, persiste côté
 * backend, puis invalide le read-model `connected-objects` (carte + KPIs cohérents).
 */
export function useNoiseLiveStatus(deviceId: number, enabled: boolean) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: ['noise-status', deviceId],
    queryFn: async () => {
      const status = await noiseDevicesApi.getStatus(deviceId);
      await qc.invalidateQueries({ queryKey: ['connected-objects'] });
      return status;
    },
    enabled,
    staleTime: 60_000,
    refetchInterval: false,
    retry: false,
  });
}
