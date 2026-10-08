import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { smartLockApi } from '../../services/api/smartLockApi';
import { noiseDevicesApi } from '../../services/api/noiseApi';
import { keyExchangeApi } from '../../services/api/keyExchangeApi';
import { environmentSensorsApi } from '../../services/api/environmentSensorsApi';
import { camerasApi } from '../../services/api/camerasApi';
import { thermostatsApi } from '../../services/api/thermostatsApi';
import type { ConnectedDevice } from './types';

/**
 * Suppression d'un objet connecté — mutation focalisée (SRP), SANS abonnement à
 * la liste : pensée pour être appelée depuis {@link DeviceCard}, chaque carte
 * gérant sa propre suppression où qu'elle soit rendue (Hub, vue par logement…).
 *
 * Dispatch vers l'API delete du type (serrure / capteur sonore / point de remise),
 * puis invalide le cache `['connected-objects']` pour rafraîchir partout. Propage
 * l'erreur au caller (feedback) ; le `finally` relâche toujours l'état de chargement.
 */
export function useDeleteDevice() {
  const qc = useQueryClient();
  const [removing, setRemoving] = useState(false);

  const remove = async (device: Pick<ConnectedDevice, 'kind' | 'id'>) => {
    setRemoving(true);
    try {
      switch (device.kind) {
        case 'lock': await smartLockApi.delete(device.id); break;
        case 'noise': await noiseDevicesApi.delete(device.id); break;
        case 'keybox': await keyExchangeApi.deletePoint(device.id); break;
        case 'camera': await camerasApi.delete(device.id); break;
        case 'thermostat': await thermostatsApi.delete(device.id); break;
        case 'climate':
        case 'contact':
        case 'motion':
        case 'smoke': await environmentSensorsApi.delete(device.id); break;
        default: throw new Error("La suppression n'est pas disponible pour ce type d'objet.");
      }
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['connected-objects'] }),
        ...(device.kind === 'camera' ? [qc.invalidateQueries({ queryKey: ['cameras'] })] : []),
        ...(device.kind === 'thermostat' ? [qc.invalidateQueries({ queryKey: ['thermostats'] }), qc.invalidateQueries({ queryKey: ['room-thermostat', device.id] })] : []),
      ]);
    } finally {
      setRemoving(false);
    }
  };

  return { remove, removing };
}
