import type { ConnectedDevice, DeviceKind } from './types';

export const ROOM_SCENES = ['entrance', 'living', 'bedroom', 'kitchen', 'bathroom', 'hallway', 'outdoor'] as const;
export type RoomScene = typeof ROOM_SCENES[number];
export const BEDROOM_ARTWORK = ['bedroom', 'bedroom-twin', 'bedroom-bunk'] as const;
export type BedroomArtwork = typeof BEDROOM_ARTWORK[number];
export type RoomArtwork = RoomScene | BedroomArtwork;
export interface DeviceRoom {
  id: string;
  name: string;
  scene: RoomScene | null;
  devices: ConnectedDevice[];
}

const normalize = (value: string) => value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();

/** Infer artwork only. Never infer or change a device's actual room assignment. */
export function sceneForRoom(name: string): RoomScene | null {
  const value = normalize(name);
  const patterns: [RoomScene, RegExp][] = [
    ['bathroom', /bain|bath|douche|shower|sdb|حمام/],
    ['bedroom', /chambre|bedroom|غرفة.*نوم/],
    ['kitchen', /cuisine|kitchen|مطبخ/],
    ['living', /salon|sejour|living|lounge|معيشة|صالون/],
    ['hallway', /couloir|palier|hallway|corridor|landing|ممر/],
    ['outdoor', /terrasse|exterieur|jardin|garden|outdoor|terrace|balcon|حديقة|شرفة|خارج/],
    ['entrance', /entree|entrance|entry|hall|مدخل/],
  ];
  return patterns.find(([, pattern]) => pattern.test(value))?.[0] ?? null;
}

/** Exact named rooms remain distinct (including Chambre 1 / Chambre 2). */
export function buildDeviceRooms(devices: ConnectedDevice[]): DeviceRoom[] {
  const rooms = new Map<string, DeviceRoom>();
  for (const device of devices) {
    const name = device.roomName?.trim() ?? '';
    const id = name ? `room:${normalize(name)}` : 'unassigned';
    if (!rooms.has(id)) rooms.set(id, { id, name, scene: name ? sceneForRoom(name) : null, devices: [] });
    rooms.get(id)!.devices.push(device);
  }
  return [...rooms.values()].sort((a, b) => {
    if (a.id === 'unassigned') return 1;
    if (b.id === 'unassigned') return -1;
    const order = (scene: RoomScene | null) => scene ? ROOM_SCENES.indexOf(scene) : ROOM_SCENES.length;
    return order(a.scene) - order(b.scene) || a.name.localeCompare(b.name, undefined, { numeric: true });
  });
}

export type OpeningVariant = 'door-open' | 'window-open' | 'both-open' | '';
export function roomArtwork(scene: RoomArtwork, variant: OpeningVariant = '') {
  return `/images/connected-rooms/baitly-${scene}${variant ? `-${variant}` : ''}.webp`;
}

/** Fill rooms declared on the property without duplicating existing named bedrooms. */
export function completePropertyRooms(actual: DeviceRoom[], property: { bedroomCount?: number; bathroomCount?: number; hasExterior?: boolean } | undefined,
  label: (scene: RoomScene, index?: number) => string): DeviceRoom[] {
  const rooms = [...actual];
  const add = (scene: RoomScene, index?: number) => rooms.push({ id: `empty:${scene}:${index ?? 0}`, name: label(scene, index), scene, devices: [] });
  for (const scene of ['entrance', 'living', 'kitchen'] as const) if (!rooms.some(room => room.scene === scene)) add(scene);
  for (const [scene, count] of [['bedroom', property?.bedroomCount], ['bathroom', property?.bathroomCount]] as const) {
    if (count == null || count <= 0) continue;
    const assigned = new Set<number>();
    const matching = rooms.filter(room => room.scene === scene);
    for (const room of matching) {
      const number = Number(room.name.match(/\d+/)?.[0]);
      if (number > 0) assigned.add(number);
    }
    for (const room of matching.filter(room => !room.name.match(/\d+/))) {
      let index = 1;
      while (assigned.has(index)) index++;
      assigned.add(index);
    }
    for (let index = 1; index <= Math.min(100, count); index++) if (!assigned.has(index)) add(scene, count > 1 ? index : undefined);
  }
  if (property?.hasExterior && !rooms.some(room => room.scene === 'outdoor')) add('outdoor');
  return rooms.sort((a, b) => {
    const order = (room: DeviceRoom) => room.id === 'unassigned' ? 100 : room.scene ? ROOM_SCENES.indexOf(room.scene) : 99;
    return order(a) - order(b) || a.name.localeCompare(b.name, undefined, { numeric: true });
  });
}

export function bedroomArtworkForName(name: string): BedroomArtwork {
  const value = normalize(name);
  return /superpose|bunk|طابق/.test(value) ? 'bedroom-bunk' : /jumeau|twin|lits separes|سريرين|سريران/.test(value) ? 'bedroom-twin' : 'bedroom';
}

// Each coordinate was checked against the generated decor. Never mirror these in RTL.
// Separate slots are also reserved for the split unit, light and both contact targets.
export type RoomDeviceSlot = DeviceKind | 'split' | 'light' | 'door-contact' | 'window-contact';
export { ROOM_DEVICE_POSITIONS, roomDevicePoint } from "./roomSceneLayout";

export type ThermalArtwork = 'thermostat' | 'split';
export type ThermalMode = 'cool' | 'heat' | 'off' | 'eco' | 'unknown';
export function thermalMode(device: ConnectedDevice): ThermalMode {
  if (device.kind !== 'thermostat' || deviceConnection(device) !== 'online') return 'unknown';
  const mode = (device.raw as { mode?: string | null })?.mode?.toLowerCase();
  return mode === 'cool' || mode === 'heat' || mode === 'off' || mode === 'eco' ? mode : 'unknown';
}
export function defaultThermalArtwork(device: ConnectedDevice): ThermalArtwork {
  return /split|clim|air.?cond|مكيف/.test(normalize(device.name)) || thermalMode(device) === 'cool' ? 'split' : 'thermostat';
}
export function deviceArtwork(device: ConnectedDevice, thermal: ThermalArtwork = defaultThermalArtwork(device)) {
  const mode = thermalMode(device);
  const key = device.kind === 'thermostat' && thermal === 'split' ? `split-${mode === 'heat' || mode === 'cool' ? mode : 'idle'}` : device.kind;
  return `/images/connected-devices/baitly-${key}.webp`;
}
export function measuredTemperature(device: ConnectedDevice): number | null {
  const raw = device.raw as { currentTempC?: number | null; temperatureC?: number | null };
  const value = device.kind === 'thermostat' ? raw?.currentTempC : device.kind === 'climate' ? raw?.temperatureC : null;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export type ContactTarget = 'door' | 'window' | 'unknown';
export function contactTarget(device: ConnectedDevice, overrides: Record<string, ContactTarget> = {}): ContactTarget {
  const saved = overrides[device.uid];
  if (saved === 'door' || saved === 'window' || saved === 'unknown') return saved;
  const name = normalize(device.name);
  if (/fenetre|window|نافذة/.test(name)) return 'window';
  if (/porte|door|portail|gate|باب/.test(name)) return 'door';
  return 'unknown';
}
export function openingState(devices: ConnectedDevice[], target: ContactTarget, overrides: Record<string, ContactTarget> = {}): 'open' | 'closed' | 'unknown' | 'unmonitored' {
  const sensors = devices.filter(device => device.kind === 'contact' && contactTarget(device, overrides) === target);
  if (!sensors.length) return 'unmonitored';
  const states = sensors.map(device => deviceConnection(device) === 'online' ? (device.raw as { contactOpen?: boolean | null })?.contactOpen : null);
  if (states.some(state => state === true)) return 'open';
  return states.every(state => state === false) ? 'closed' : 'unknown';
}
export const sceneHasWindow = (scene: RoomArtwork) => !['entrance', 'hallway', 'outdoor'].includes(scene);
export function openingVariant(scene: RoomArtwork, devices: ConnectedDevice[], overrides: Record<string, ContactTarget> = {}): OpeningVariant {
  const doorOpen = openingState(devices, 'door', overrides) === 'open';
  const windowOpen = sceneHasWindow(scene) && openingState(devices, 'window', overrides) === 'open';
  return doorOpen && windowOpen ? 'both-open' : doorOpen ? 'door-open' : windowOpen ? 'window-open' : '';
}

export function deviceConnection(device: ConnectedDevice): 'online' | 'offline' | 'unknown' {
  return device.statusLevel === 'unknown' ? 'unknown' : device.online ? 'online' : 'offline';
}

export function roomDeviceGroups(devices: ConnectedDevice[], contacts: Record<string, ContactTarget> = {}, thermal: Record<string, ThermalArtwork> = {}) {
  const groups = new Map<RoomDeviceSlot, ConnectedDevice[]>();
  for (const device of devices) {
    const target = contactTarget(device, contacts);
    const slot: RoomDeviceSlot = device.kind === 'thermostat' && (thermal[device.uid] ?? defaultThermalArtwork(device)) === 'split' ? 'split'
      : device.kind === 'contact' && target !== 'unknown' ? `${target}-contact` : device.kind;
    groups.set(slot, [...(groups.get(slot) ?? []), device]);
  }
  return [...groups.entries()];
}
