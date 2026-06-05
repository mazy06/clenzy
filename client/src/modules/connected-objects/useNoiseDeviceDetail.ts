import { useQuery } from '@tanstack/react-query';
import { noiseDevicesApi } from '../../services/api/noiseApi';
import type { NoiseMonitoringData, PropertyNoiseData } from '../../hooks/useNoiseMonitoring';
import type { ConnectedDevice } from './types';

/**
 * Adapte l'historique live d'UN capteur (Tuya/Minut) au format attendu par
 * {@link NoiseMonitorChart}. On utilise une seule constante `label = device.name`
 * partout (clé des séries du chart) pour aligner `combinedChartData` ↔ `properties`.
 * Vide tant que le capteur n'a pas d'historique cloud (le chart affiche alors son
 * état vide intégré).
 */
export function useNoiseDeviceDetail(device: ConnectedDevice) {
  const label = device.name;

  const query = useQuery({
    queryKey: ['noise-device-data', device.id],
    queryFn: () => noiseDevicesApi.getNoiseData(device.id),
    enabled: device.kind === 'noise',
    staleTime: 60_000,
  });

  const points = query.data ?? [];
  const history = points.map((p) => ({ time: p.time, decibels: p.decibels, property: label }));
  const levels = history.map((h) => h.decibels);

  const property: PropertyNoiseData = {
    propertyId: device.propertyId ?? 0,
    propertyName: label,
    currentLevel: levels.length ? levels[levels.length - 1] : 0,
    averageLevel: levels.length ? Math.round(levels.reduce((a, b) => a + b, 0) / levels.length) : 0,
    maxLevel: levels.length ? Math.max(...levels) : 0,
    history,
    alerts: [],
  };

  const data: NoiseMonitoringData = {
    enabled: true,
    properties: [property],
    allAlerts: [],
    globalAverage: property.averageLevel,
  };

  const combinedChartData = history.map((h) => ({ time: h.time, [label]: h.decibels }));

  return { data, combinedChartData, loading: query.isLoading };
}
