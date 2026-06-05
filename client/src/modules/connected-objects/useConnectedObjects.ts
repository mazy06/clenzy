import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { smartLockApi, type SmartLockDeviceDto } from '../../services/api/smartLockApi';
import { noiseDevicesApi, type NoiseDeviceDto } from '../../services/api/noiseApi';
import { keyExchangeApi, type KeyExchangePointDto } from '../../services/api/keyExchangeApi';
import { devicesApi, type DeviceSummaryDto, type ProviderStatusDto } from '../../services/api/devicesApi';
import { environmentSensorsApi, type EnvironmentSensorDto, type SensorType } from '../../services/api/environmentSensorsApi';
import type {
  ConnectedDevice,
  ConnectedObjectsKpis,
  DeviceKind,
  DeviceProvider,
  DeviceStatusLevel,
  PropertyDeviceGroup,
} from './types';

const LOW_BATTERY = 20;

const EMPTY_KPIS: ConnectedObjectsKpis = { total: 0, online: 0, offline: 0, alerts: 0, lowBattery: 0 };

// ─── Projections par type vers le modèle unifié (fallback legacy) ────────────

function mapLock(d: SmartLockDeviceDto): ConnectedDevice {
  // online tri-état : null = jamais synchronisé (→ « inconnu », pas « hors ligne »).
  const known = d.online != null;
  const online = d.online === true;
  const locked = (d.lockState || '').toUpperCase() === 'LOCKED';
  const unlocked = (d.lockState || '').toUpperCase() === 'UNLOCKED';
  const lowBattery = d.batteryLevel != null && d.batteryLevel <= LOW_BATTERY;
  return {
    uid: `lock:${d.id}`,
    kind: 'lock',
    id: d.id,
    name: d.name,
    propertyId: d.propertyId ?? null,
    propertyName: d.propertyName || 'Sans logement',
    roomName: d.roomName,
    provider: (d.brand as DeviceProvider) || 'UNKNOWN',
    statusLevel: !known ? 'unknown' : !online ? 'offline' : lowBattery ? 'warning' : 'ok',
    statusLabel: !known ? 'État inconnu' : !online ? 'Hors ligne' : locked ? 'Verrouillée' : unlocked ? 'Déverrouillée' : 'État inconnu',
    primaryMetric: d.batteryLevel != null ? { label: 'Batterie', value: `${d.batteryLevel}%` } : null,
    battery: d.batteryLevel,
    online,
    alertCount: 0,
    actions: ['lock', 'unlock'],
    raw: d,
  };
}

function mapNoise(d: NoiseDeviceDto): ConnectedDevice {
  // online tri-état : null = jamais synchronisé (→ « En attente », pas « actif »).
  const known = d.online != null;
  const online = d.online === true;
  return {
    uid: `noise:${d.id}`,
    kind: 'noise',
    id: d.id,
    name: d.name,
    propertyId: d.propertyId ?? null,
    propertyName: d.propertyName || 'Sans logement',
    roomName: d.roomName,
    provider: (d.deviceType?.toUpperCase() as DeviceProvider) || 'UNKNOWN',
    statusLevel: !known ? 'unknown' : online ? 'ok' : 'offline',
    statusLabel: !known ? 'En attente' : online ? 'Surveillance active' : 'Hors ligne',
    primaryMetric: null,
    battery: null,
    online,
    alertCount: 0,
    actions: ['view'],
    raw: d,
  };
}

function mapPoint(d: KeyExchangePointDto): ConnectedDevice {
  const online = (d.status || '').toUpperCase() === 'ACTIVE';
  return {
    uid: `keybox:${d.id}`,
    kind: 'keybox',
    id: d.id,
    name: d.storeName || 'Point de remise',
    propertyId: d.propertyId ?? null,
    propertyName: d.propertyName || 'Sans logement',
    roomName: null,
    provider: d.provider || 'UNKNOWN',
    statusLevel: online ? 'ok' : 'offline',
    statusLabel: online ? 'Actif' : 'Inactif',
    primaryMetric: { label: 'Codes actifs', value: String(d.activeCodesCount ?? 0) },
    battery: null,
    online,
    alertCount: 0,
    actions: ['view'],
    raw: d,
  };
}

// ─── Capteurs d'environnement (GET /api/environment-sensors) ─────────────────

const SENSOR_KIND: Record<SensorType, DeviceKind> = {
  TEMP_HUMIDITY: 'climate',
  CONTACT: 'contact',
  MOTION: 'motion',
  SMOKE: 'smoke',
};

/** Projette un capteur d'environnement (DTO riche) sur le modèle unifié. La
 *  métrique principale + la sévérité dépendent du type (ouvert/fermé, mouvement,
 *  fumée, temp/humidité). Fumée détectée = critique, ouvert/mouvement = attention. */
function mapSensor(d: EnvironmentSensorDto): ConnectedDevice {
  const kind = SENSOR_KIND[d.sensorType];
  const known = d.online != null;
  const online = d.online === true;
  const lowBattery = d.batteryLevel != null && d.batteryLevel <= LOW_BATTERY;

  let metric: { label: string; value: string } | null = null;
  let level: DeviceStatusLevel = !known ? 'unknown' : online ? 'ok' : 'offline';
  let label = !known ? 'En attente' : online ? 'En ligne' : 'Hors ligne';
  let alert = 0;

  if (online) {
    if (kind === 'climate') {
      const parts = [
        d.temperatureC != null ? `${d.temperatureC.toFixed(1)} °C` : null,
        d.humidity != null ? `${d.humidity} %` : null,
      ].filter(Boolean) as string[];
      metric = parts.length ? { label: 'Mesure', value: parts.join(' · ') } : null;
      if (parts.length) label = parts.join(' · ');
    } else if (kind === 'contact') {
      const open = d.contactOpen === true;
      metric = { label: 'État', value: open ? 'Ouvert' : 'Fermé' };
      level = open ? 'warning' : 'ok';
      label = open ? 'Ouvert' : 'Fermé';
    } else if (kind === 'motion') {
      const moving = d.motionDetected === true;
      metric = { label: 'Mouvement', value: moving ? 'Détecté' : 'Aucun' };
      if (moving) { level = 'warning'; alert = 1; }
      label = moving ? 'Mouvement détecté' : 'Aucun mouvement';
    } else if (kind === 'smoke') {
      const smoke = d.smokeDetected === true;
      metric = { label: 'Fumée', value: smoke ? 'Détectée' : 'OK' };
      if (smoke) { level = 'critical'; alert = 1; }
      label = smoke ? 'Fumée détectée' : 'Aucune fumée';
    }
  }
  // Batterie faible : dégrade en attention si rien de plus grave.
  if (lowBattery && level === 'ok') level = 'warning';

  return {
    uid: `${kind}:${d.id}`,
    kind,
    id: d.id,
    name: d.name,
    propertyId: d.propertyId ?? null,
    propertyName: d.propertyName || 'Sans logement',
    roomName: d.roomName,
    provider: (d.brand as DeviceProvider) || 'UNKNOWN',
    statusLevel: level,
    statusLabel: label,
    primaryMetric: metric,
    battery: d.batteryLevel,
    online,
    alertCount: alert,
    actions: ['view'],
    raw: d,
  };
}

// ─── Projection du read-model backend unifié (GET /api/devices) ──────────────

function mapSummary(d: DeviceSummaryDto): ConnectedDevice {
  // online vient du read-model : vrai flag Tuya pour les serrures, status===ACTIVE
  // pour les autres types. null = jamais synchronisé (serrures uniquement).
  const known = d.online != null;
  const online = d.online === true;
  const provider = (d.provider as DeviceProvider) || 'UNKNOWN';
  const propertyName = d.propertyName || 'Sans logement';
  const propertyId = d.propertyId ?? null;

  if (d.kind === 'lock') {
    const locked = (d.lockState || '').toUpperCase() === 'LOCKED';
    const unlocked = (d.lockState || '').toUpperCase() === 'UNLOCKED';
    const lowBattery = d.batteryLevel != null && d.batteryLevel <= LOW_BATTERY;
    return {
      uid: `lock:${d.id}`, kind: 'lock', id: d.id, name: d.name, propertyId, propertyName, roomName: d.roomName, provider,
      statusLevel: !known ? 'unknown' : !online ? 'offline' : lowBattery ? 'warning' : 'ok',
      statusLabel: !known ? 'État inconnu' : !online ? 'Hors ligne' : locked ? 'Verrouillée' : unlocked ? 'Déverrouillée' : 'État inconnu',
      primaryMetric: d.batteryLevel != null ? { label: 'Batterie', value: `${d.batteryLevel}%` } : null,
      battery: d.batteryLevel, online, alertCount: 0, actions: ['lock', 'unlock'], raw: d,
    };
  }
  if (d.kind === 'noise') {
    return {
      uid: `noise:${d.id}`, kind: 'noise', id: d.id, name: d.name, propertyId, propertyName, roomName: d.roomName, provider,
      statusLevel: !known ? 'unknown' : online ? 'ok' : 'offline',
      statusLabel: !known ? 'En attente' : online ? 'Surveillance active' : 'Hors ligne',
      primaryMetric: null, battery: null, online, alertCount: 0, actions: ['view'], raw: d,
    };
  }
  if (d.kind === 'camera') {
    return {
      uid: `camera:${d.id}`, kind: 'camera', id: d.id, name: d.name, propertyId, propertyName, roomName: d.roomName, provider,
      statusLevel: online ? 'ok' : 'offline',
      statusLabel: online ? 'En ligne' : 'Hors ligne',
      primaryMetric: null, battery: null, online, alertCount: 0, actions: ['view'], previewUrl: d.snapshotUrl, raw: d,
    };
  }
  if (d.kind === 'thermostat') {
    return {
      uid: `thermostat:${d.id}`, kind: 'thermostat', id: d.id, name: d.name, propertyId, propertyName, roomName: d.roomName, provider,
      statusLevel: online ? 'ok' : 'offline',
      statusLabel: online ? 'Actif' : 'Inactif',
      primaryMetric: null, battery: null, online, alertCount: 0, actions: ['view'], raw: d,
    };
  }
  return {
    uid: `keybox:${d.id}`, kind: 'keybox', id: d.id, name: d.name, propertyId, propertyName, roomName: d.roomName, provider,
    statusLevel: online ? 'ok' : 'offline',
    statusLabel: online ? 'Actif' : 'Inactif',
    primaryMetric: { label: 'Codes actifs', value: String(d.activeCodesCount ?? 0) },
    battery: null, online, alertCount: 0, actions: ['view'], raw: d,
  };
}

// ─── Agrégation ──────────────────────────────────────────────────────────────

function groupByProperty(devices: ConnectedDevice[]): PropertyDeviceGroup[] {
  const map = new Map<string, PropertyDeviceGroup>();
  for (const d of devices) {
    const key = d.propertyId != null ? `p:${d.propertyId}` : 'none';
    if (!map.has(key)) {
      map.set(key, { propertyId: d.propertyId, propertyName: d.propertyName, devices: [] });
    }
    map.get(key)!.devices.push(d);
  }
  // Logements triés alpha ; « Sans logement » en dernier.
  return [...map.values()].sort((a, b) => {
    if (a.propertyId == null) return 1;
    if (b.propertyId == null) return -1;
    return a.propertyName.localeCompare(b.propertyName);
  });
}

function computeKpis(devices: ConnectedDevice[]): ConnectedObjectsKpis {
  return {
    total: devices.length,
    online: devices.filter((d) => d.online).length,
    offline: devices.filter((d) => !d.online).length,
    alerts: devices.reduce((sum, d) => sum + (d.alertCount ?? 0), 0),
    lowBattery: devices.filter((d) => d.battery != null && d.battery <= LOW_BATTERY).length,
  };
}

interface DevicesResult {
  devices: ConnectedDevice[];
  groups: PropertyDeviceGroup[];
  kpis: ConnectedObjectsKpis;
}

function buildResult(devices: ConnectedDevice[]): DevicesResult {
  return { devices, groups: groupByProperty(devices), kpis: computeKpis(devices) };
}

/** Agrégation legacy (3 appels par type) — fallback si le read-model n'est pas dispo. */
async function fetchAllLegacy(): Promise<DevicesResult> {
  const [locks, noise, points] = await Promise.all([
    smartLockApi.getAll().catch(() => [] as SmartLockDeviceDto[]),
    noiseDevicesApi.getAll().catch(() => [] as NoiseDeviceDto[]),
    keyExchangeApi.getPoints().catch(() => [] as KeyExchangePointDto[]),
  ]);
  return buildResult([...locks.map(mapLock), ...noise.map(mapNoise), ...points.map(mapPoint)]);
}

/**
 * Read-model unifié backend (serrures/bruit/keybox/caméra/thermostat via 1 appel)
 * + capteurs d'environnement (appel dédié), fusionnés. Repli auto sur l'agrégation
 * legacy pour la 1re partie ; les capteurs sont récupérés indépendamment.
 */
async function fetchAll(): Promise<DevicesResult> {
  const sensorsPromise = environmentSensorsApi.getAll().catch(() => [] as EnvironmentSensorDto[]);
  let base: ConnectedDevice[];
  try {
    const summaries = await devicesApi.getAll();
    base = summaries.map(mapSummary);
  } catch {
    base = (await fetchAllLegacy()).devices;
  }
  const sensors = (await sensorsPromise).map(mapSensor);
  return buildResult([...base, ...sensors]);
}

/** Statut providers backend ; null si indisponible (→ repli présence côté hook). */
async function fetchProviders(): Promise<ProviderStatusDto[] | null> {
  try {
    return await devicesApi.getProviders();
  } catch {
    return null;
  }
}

/** Repli : dérive le statut providers de la simple présence d'objets. */
function presenceProviders(devices: ConnectedDevice[]): ProviderStatusDto[] {
  const map = new Map<string, number>();
  devices.forEach((d) => {
    if (d.provider !== 'UNKNOWN') map.set(d.provider, (map.get(d.provider) ?? 0) + 1);
  });
  return [...map.entries()].map(([provider, deviceCount]) => ({
    provider, connected: true, deviceCount, status: null,
  }));
}

/**
 * Hub des objets connectés — agrège serrures + capteurs + points de remise dans
 * un modèle unifié, groupé par logement. Consomme le read-model backend
 * `GET /api/devices` (repli sur les 3 APIs par type si indisponible). Polling 30 s.
 * Les actions (lock/unlock) restent par type côté API ; exposées via `act(uid)`.
 */
export function useConnectedObjects() {
  const qc = useQueryClient();
  const [actingUid, setActingUid] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['connected-objects'],
    queryFn: fetchAll,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  const providersQuery = useQuery({
    queryKey: ['connected-objects', 'providers'],
    queryFn: fetchProviders,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const data = query.data ?? { devices: [], groups: [], kpis: EMPTY_KPIS };

  // Statut réel des providers si dispo, sinon dérivé de la présence d'objets.
  const providers: ProviderStatusDto[] = providersQuery.data ?? presenceProviders(data.devices);

  const act = async (uid: string, action: 'lock' | 'unlock') => {
    const dev = data.devices.find((d) => d.uid === uid);
    if (!dev || dev.kind !== 'lock') return;
    setActingUid(uid);
    try {
      if (action === 'lock') await smartLockApi.lock(dev.id);
      else await smartLockApi.unlock(dev.id);
      await qc.invalidateQueries({ queryKey: ['connected-objects'] });
    } finally {
      setActingUid(null);
    }
  };

  return {
    devices: data.devices,
    groups: data.groups,
    kpis: data.kpis,
    providers,
    loading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
    act,
    actingUid,
  };
}
