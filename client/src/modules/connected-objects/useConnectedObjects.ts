import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { smartLockApi, type SmartLockDeviceDto } from '../../services/api/smartLockApi';
import { noiseDevicesApi, type NoiseDeviceDto } from '../../services/api/noiseApi';
import { keyExchangeApi, type KeyExchangePointDto } from '../../services/api/keyExchangeApi';
import type {
  ConnectedDevice,
  ConnectedObjectsKpis,
  DeviceProvider,
  PropertyDeviceGroup,
} from './types';

const LOW_BATTERY = 20;

const EMPTY_KPIS: ConnectedObjectsKpis = { total: 0, online: 0, offline: 0, alerts: 0, lowBattery: 0 };

// ─── Projections par type vers le modèle unifié ──────────────────────────────

function mapLock(d: SmartLockDeviceDto): ConnectedDevice {
  const online = (d.status || '').toUpperCase() === 'ACTIVE';
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
    statusLevel: !online ? 'offline' : lowBattery ? 'warning' : 'ok',
    statusLabel: !online ? 'Hors ligne' : locked ? 'Verrouillée' : unlocked ? 'Déverrouillée' : 'État inconnu',
    primaryMetric: d.batteryLevel != null ? { label: 'Batterie', value: `${d.batteryLevel}%` } : null,
    battery: d.batteryLevel,
    online,
    alertCount: 0,
    actions: ['lock', 'unlock'],
    raw: d,
  };
}

function mapNoise(d: NoiseDeviceDto): ConnectedDevice {
  const online = (d.status || '').toUpperCase() === 'ACTIVE';
  return {
    uid: `noise:${d.id}`,
    kind: 'noise',
    id: d.id,
    name: d.name,
    propertyId: d.propertyId ?? null,
    propertyName: d.propertyName || 'Sans logement',
    roomName: d.roomName,
    provider: (d.deviceType?.toUpperCase() as DeviceProvider) || 'UNKNOWN',
    statusLevel: online ? 'ok' : 'offline',
    statusLabel: online ? 'Surveillance active' : 'Inactif',
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

async function fetchAll(): Promise<{
  devices: ConnectedDevice[];
  groups: PropertyDeviceGroup[];
  kpis: ConnectedObjectsKpis;
}> {
  const [locks, noise, points] = await Promise.all([
    smartLockApi.getAll().catch(() => [] as SmartLockDeviceDto[]),
    noiseDevicesApi.getAll().catch(() => [] as NoiseDeviceDto[]),
    keyExchangeApi.getPoints().catch(() => [] as KeyExchangePointDto[]),
  ]);
  const devices = [
    ...locks.map(mapLock),
    ...noise.map(mapNoise),
    ...points.map(mapPoint),
  ];
  return { devices, groups: groupByProperty(devices), kpis: computeKpis(devices) };
}

/**
 * Hub des objets connectés — agrège serrures + capteurs + points de remise dans
 * un modèle unifié, groupé par logement. Polling 30 s pour un état « vivant ».
 * Les actions (lock/unlock) restent par type côté API ; ici on les expose de
 * manière homogène via `act(uid, action)`.
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

  const data = query.data ?? { devices: [], groups: [], kpis: EMPTY_KPIS };

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
    loading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
    act,
    actingUid,
  };
}
