import type { OpeningVariant, RoomArtwork, RoomDeviceSlot } from './roomModel';
import spriteBounds from './sceneSpriteBounds.json';

export type SceneDevicePose = 'left' | 'right' | 'front';
export interface SceneDevicePlacement {
  x: number;
  y: number;
  /** Visible object width as a percentage of the room canvas, never a pixel minimum. */
  width: number;
  pose: SceneDevicePose;
  anchor?: 'bottom';
  rotation: number;
  tiltX: number;
  tiltY: number;
  skewY: number;
  mirrored: boolean;
}
export type SceneLayoutPreferences = Record<string, SceneDevicePlacement>;
type Mount = [x: number, y: number, pose?: SceneDevicePose];
type Mounts = Record<RoomDeviceSlot, Mount>;

// Calibrated against each 1448 × 1086 illustration. A tabletop coordinate is the
// bottom of the device; wall coordinates are its centre. These are illustrative
// mounting points, never installation instructions or actual room measurements.
const MOUNTS: Record<RoomArtwork, Mounts> = {
  entrance: { lock:[68.1,31.6,'front'], keybox:[75.3,32,'front'], camera:[83,15.4,'front'], noise:[40,25,'right'], thermostat:[44,33,'right'], climate:[31,34,'right'], contact:[69.9,19,'front'], motion:[43,17,'right'], smoke:[38,16,'right'], split:[43,13,'right'], light:[76,25,'front'], 'door-contact':[69.9,19,'front'], 'window-contact':[69.9,19,'front'] },
  living: { lock:[12.7,41.2], keybox:[17.5,32], camera:[51,12,'right'], noise:[28,25], thermostat:[43,25], climate:[62.2,31.5,'right'], contact:[14.1,28], motion:[59,17,'right'], smoke:[45,9], split:[36,17], light:[10.5,20], 'door-contact':[14.1,28], 'window-contact':[83.6,29.8,'right'] },
  bedroom: { lock:[13.4,44.5], keybox:[17.8,35], camera:[54,12,'right'], noise:[27,26], thermostat:[45,20], climate:[50.9,34.5,'left'], contact:[14.4,32], motion:[56,14,'right'], smoke:[46,9], split:[36,17], light:[11,24], 'door-contact':[14.4,32], 'window-contact':[70.8,24,'right'] },
  'bedroom-twin': { lock:[13.2,42.9], keybox:[17.2,32], camera:[53,12,'right'], noise:[27,28], thermostat:[42,21], climate:[37,42.4,'left'], contact:[14.7,30], motion:[57,14,'right'], smoke:[45,9], split:[36,16], light:[10.4,22], 'door-contact':[14.7,30], 'window-contact':[72,23.6,'right'] },
  'bedroom-bunk': { lock:[8.2,46.6], keybox:[18.2,48], camera:[54,12,'right'], noise:[23.5,22], thermostat:[67,31,'right'], climate:[73.5,46.8,'right'], contact:[6.4,34], motion:[66,20,'right'], smoke:[48,10], split:[34,14], light:[11,21], 'door-contact':[6.4,34], 'window-contact':[79,25.5,'right'] },
  kitchen: { lock:[8.4,47.6], keybox:[18.2,35], camera:[53,14,'right'], noise:[26,28], thermostat:[60,27,'right'], climate:[57.5,37.7,'right'], contact:[6.8,34], motion:[62,16,'right'], smoke:[43,10], split:[34,18], light:[11,22], 'door-contact':[6.8,34], 'window-contact':[68,21,'right'] },
  bathroom: { lock:[15.2,51.9], keybox:[20,36], camera:[44,12,'right'], noise:[24,31], thermostat:[26,21], climate:[40.7,40.5,'left'], contact:[16.3,37], motion:[45,15,'right'], smoke:[37,11], split:[26,16], light:[11,26], 'door-contact':[16.3,37], 'window-contact':[59.9,22,'right'] },
  hallway: { lock:[36,34.5], keybox:[41.3,35], camera:[67,19,'right'], noise:[21,22], thermostat:[42.5,30], climate:[53,43,'right'], contact:[37.5,23], motion:[65.5,24,'right'], smoke:[42,10], split:[29,16], light:[22,27], 'door-contact':[37.5,23], 'window-contact':[37.5,23] },
  outdoor: { lock:[79.3,31,'right'], keybox:[85,33,'right'], camera:[64,23,'right'], noise:[26,29], thermostat:[59,27,'right'], climate:[40,40,'left'], contact:[79.9,23,'right'], motion:[32,25], smoke:[32,21], split:[32,29], light:[88,36,'right'], 'door-contact':[79.9,23,'right'], 'window-contact':[79.9,23,'right'] },
};

const WIDTH: Record<RoomDeviceSlot, number> = {
  lock: 2.7, keybox: 2.1, camera: 4.1, noise: 2.2, thermostat: 2.5,
  climate: 2.1, contact: 1.3, motion: 2.3, smoke: 2.7, split: 15,
  light: 1.5, 'door-contact': 1.3, 'window-contact': 1.3,
};

export const ROOM_DEVICE_POSITIONS = Object.fromEntries(Object.entries(MOUNTS).map(([scene, mounts]) => [scene,
  Object.fromEntries(Object.entries(mounts).map(([slot, [x, y]]) => [slot, [x, y]])),
])) as Record<RoomArtwork, Record<RoomDeviceSlot, [number, number]>>;

export function roomDevicePoint(scene: RoomArtwork, slot: RoomDeviceSlot): [number, number] {
  return ROOM_DEVICE_POSITIONS[scene][slot];
}

export function sceneDevicePlacement(scene: RoomArtwork, slot: RoomDeviceSlot, _variant: OpeningVariant = '', index = 0): SceneDevicePlacement {
  const [x, y, pose = 'left'] = MOUNTS[scene][slot];
  return { x: Math.min(95, x + index * 3.5), y, pose, width: WIDTH[slot], rotation: 0, tiltX: 0, tiltY: 0,
    skewY: slot === 'split' ? (pose === 'left' ? -10 : 10) : 0, mirrored: false,
    ...(slot === 'climate' ? { anchor: 'bottom' as const } : {}) };
}

/** Scene sprites are independent from the catalogue pictures in the inspector. */
export function sceneDeviceSprite(slot: RoomDeviceSlot, pose: SceneDevicePose, scene: RoomArtwork): keyof typeof spriteBounds {
  const product = slot === 'door-contact' || slot === 'window-contact' ? 'contact' : slot === 'split' ? 'split-idle' : slot;
  const handing = slot === 'lock' && scene !== 'kitchen' && scene !== 'bedroom-bunk' ? '-lever-left' : '';
  const key = `${product}-${pose}${handing}`;
  return (key in spriteBounds ? key : `${product}-left${handing}`) as keyof typeof spriteBounds;
}

export function sceneDevicePoses(slot: RoomDeviceSlot): SceneDevicePose[] {
  const product = slot === 'door-contact' || slot === 'window-contact' ? 'contact' : slot === 'split' ? 'split-idle' : slot;
  return (['left', 'right', 'front'] as const).filter(pose => `${product}-${pose}` in spriteBounds);
}

// Distinct keys preserve placement when changing room decor or opening state.
export function scenePlacementKey(roomId: string, scene: RoomArtwork, variant: OpeningVariant, uid: string, slot: RoomDeviceSlot): string {
  return JSON.stringify([roomId, scene, variant, uid, slot]);
}

export const PLACEMENT_LIMITS = { x: [1, 99], y: [1, 99], width: [0.6, 30], rotation: [-180, 180], tiltX: [-60, 60], tiltY: [-60, 60], skewY: [-35, 35] } as const;
export type PlacementNumber = keyof typeof PLACEMENT_LIMITS;

export function normalizePlacement(value: Partial<SceneDevicePlacement> | null | undefined, fallback: SceneDevicePlacement): SceneDevicePlacement {
  const next = { ...fallback };
  for (const key of Object.keys(PLACEMENT_LIMITS) as PlacementNumber[]) {
    const number = value?.[key];
    const [min, max] = PLACEMENT_LIMITS[key];
    if (typeof number === 'number' && Number.isFinite(number)) next[key] = Math.round(Math.min(max, Math.max(min, number)) * 100) / 100;
  }
  if (value?.pose && ['left', 'right', 'front'].includes(value.pose)) next.pose = value.pose;
  if (typeof value?.mirrored === 'boolean') next.mirrored = value.mirrored;
  return next;
}

export function moveSceneDevice(placement: SceneDevicePlacement, dx: number, dy: number, canvas: { width: number; height: number }): SceneDevicePlacement {
  if (canvas.width <= 0 || canvas.height <= 0) return placement;
  return normalizePlacement({ ...placement, x: placement.x + dx / canvas.width * 100, y: placement.y + dy / canvas.height * 100 }, placement);
}

export function sceneSpriteTransform(placement: SceneDevicePlacement): string {
  return `perspective(300px) rotateZ(${placement.rotation}deg) rotateX(${placement.tiltX}deg) rotateY(${placement.tiltY}deg) skewY(${placement.skewY}deg) scaleX(${placement.mirrored ? -1 : 1})`;
}

export { spriteBounds };
