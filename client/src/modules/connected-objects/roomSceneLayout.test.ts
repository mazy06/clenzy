import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { moveSceneDevice, normalizePlacement, ROOM_DEVICE_POSITIONS, sceneDevicePlacement, sceneDevicePoses, sceneDeviceSprite, scenePlacementKey, spriteBounds } from './roomSceneLayout';
import type { RoomArtwork, RoomDeviceSlot } from './roomModel';

describe('room device placement', () => {
  it('keeps each device, room illustration and opening state independent', () => {
    const keys = [
      scenePlacementKey('chambre 1', 'bedroom', '', 'climate:1', 'climate'),
      scenePlacementKey('chambre 1', 'bedroom', '', 'climate:2', 'climate'),
      scenePlacementKey('chambre 2', 'bedroom', '', 'climate:1', 'climate'),
      scenePlacementKey('chambre 1', 'bedroom-twin', '', 'climate:1', 'climate'),
      scenePlacementKey('chambre 1', 'bedroom', 'door-open', 'climate:1', 'climate'),
    ];
    expect(new Set(keys).size).toBe(keys.length);
  });
  it('moves in canvas coordinates at any viewport size and clamps to the scene', () => {
    const base = sceneDevicePlacement('living', 'thermostat');
    const small = moveSceneDevice(base, 30, -15, { width: 300, height: 225 });
    const large = moveSceneDevice(base, 100, -50, { width: 1000, height: 750 });
    expect(small).toEqual(large);
    expect(small.x).toBe(base.x + 10);
    expect(moveSceneDevice(base, 10000, -10000, { width: 300, height: 225 })).toMatchObject({ x: 99, y: 1 });
    expect(moveSceneDevice(base, 5, 5, { width: 0, height: 0 })).toEqual(base);
  });
  it('rejects invalid persisted geometry without losing valid fields', () => {
    const base = sceneDevicePlacement('kitchen', 'smoke');
    expect(normalizePlacement({ x: NaN, y: Infinity, width: -99, tiltY: 200, rotation: 22 }, base)).toMatchObject({ x: base.x, y: base.y, width: 0.6, tiltY: 60, rotation: 22 });
  });
  it('ships alpha sprites for all offered camera angles and realistic mounting types', () => {
    for (const scene of Object.keys(ROOM_DEVICE_POSITIONS) as RoomArtwork[]) {
      const smoke = sceneDevicePlacement(scene, 'smoke');
      expect(['left', 'right']).toContain(smoke.pose);
      expect(smoke.y).toBeGreaterThanOrEqual(9);
      expect(smoke.width).toBeLessThan(3);
      expect(sceneDevicePlacement(scene, 'climate').anchor).toBe('bottom');
      for (const slot of Object.keys(ROOM_DEVICE_POSITIONS[scene]) as RoomDeviceSlot[]) {
        for (const pose of sceneDevicePoses(slot)) {
          const sprite = sceneDeviceSprite(slot, pose, scene);
          expect(spriteBounds[sprite]).toBeDefined();
          const data = readFileSync(resolve(process.cwd(), `public/images/connected-devices/scene/baitly-${sprite}.webp`));
          expect(data.subarray(12, 16).toString()).toBe('VP8X');
          expect(data[20] & 0x10).toBe(0x10);
        }
      }
    }
  });
});
