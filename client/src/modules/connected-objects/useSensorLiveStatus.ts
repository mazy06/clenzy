import { useQuery, useQueryClient } from '@tanstack/react-query';
import { environmentSensorsApi } from '../../services/api/environmentSensorsApi';

/**
 * Rafraîchit UNE fois l'état réel d'un capteur d'environnement (température/humidité,
 * contact, mouvement, fumée — Tuya OU Netatmo) au montage de sa carte. L'appel
 * `POST /environment-sensors/{id}/refresh` lit le provider (Tuya/Netatmo) et persiste
 * l'état ; au succès on invalide le read-model `connected-objects` (carte + détail +
 * KPIs cohérents). Résout l'« init » : sans ça un capteur fraîchement ajouté reste
 * « En attente » faute de déclencheur de lecture. Pas de polling (staleTime 60s).
 */
export function useSensorLiveStatus(deviceId: number, enabled: boolean) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: ['sensor-status', deviceId],
    queryFn: async () => {
      const s = await environmentSensorsApi.refresh(deviceId);
      await qc.invalidateQueries({ queryKey: ['connected-objects'] });
      return s;
    },
    enabled,
    staleTime: 60_000,
    refetchInterval: false,
    retry: false,
  });
}
