import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildDeviceRooms, completePropertyRooms, contactTarget, deviceArtwork, openingState, openingVariant, roomArtwork, roomDeviceGroups, ROOM_DEVICE_POSITIONS, thermalMode } from './roomModel';
import type { ConnectedDevice } from './types';

const device = (values: Partial<ConnectedDevice> = {}): ConnectedDevice => ({ uid: 'contact:1', id: 1, kind: 'contact', name: 'Fenêtre', propertyId: 1, propertyName: 'Test', roomName: 'Chambre 1', provider: 'TUYA', online: true, statusLevel: 'ok', statusLabel: 'Fermée', actions: ['view'], raw: { contactOpen: false }, ...values });

describe('Baitly room scenes', () => {
  it('keeps numbered rooms separate and unassigned devices outside every room', () => {
    const rooms = buildDeviceRooms([device(), device({ uid: 'contact:2', roomName: 'Chambre 2' }), device({ uid: 'lock:3', roomName: null })]);
    expect(rooms.map(room => room.id)).toEqual(['room:chambre 1', 'room:chambre 2', 'unassigned']);
    expect(rooms[2].scene).toBeNull();
  });
  it('completes the property bedroom count without inventing equipment', () => {
    const rooms = completePropertyRooms(buildDeviceRooms([device({ roomName: 'Chambre' })]), { bedroomCount: 3, bathroomCount: 2 }, (scene, index) => `${scene}${index ?? ''}`);
    expect(rooms.filter(room => room.scene === 'bedroom')).toHaveLength(3);
    expect(rooms.filter(room => room.scene === 'bathroom')).toHaveLength(2);
    expect(rooms.reduce((sum, room) => sum + room.devices.length, 0)).toBe(1);
  });
  it('does not equate missing, offline or unconfigured contact data with a closed opening', () => {
    expect(openingState([], 'window')).toBe('unmonitored');
    expect(openingState([device({ raw: {} })], 'window')).toBe('unknown');
    expect(openingState([device({ online: false, statusLevel: 'offline', raw: { contactOpen: true } })], 'window')).toBe('unknown');
    expect(openingState([device()], 'window')).toBe('closed');
  });
  it('selects both-open only with reported open door and window', () => {
    const devices = [device({ raw: { contactOpen: true } }), device({ uid: 'contact:2', name: 'Porte', raw: { contactOpen: true } })];
    expect(openingVariant('living', devices)).toBe('both-open');
    expect(openingVariant('entrance', devices)).toBe('door-open');
    expect(openingVariant('living', [device({ raw: { contactOpen: true } })])).toBe('window-open');
  });
  it('accepts an explicit contact illustration association and keeps separate markers', () => {
    const anonymous = device({ name: 'Capteur 1' });
    expect(contactTarget(anonymous)).toBe('unknown');
    expect(contactTarget(anonymous, { 'contact:1': 'door' })).toBe('door');
    const groups = roomDeviceGroups([anonymous, device({ uid: 'contact:2' })], { 'contact:1': 'door' });
    expect(groups.map(([slot]) => slot)).toEqual(['door-contact', 'window-contact']);
  });
  it('shows the cooling/heating image from reported mode, never inferred from temperature alone', () => {
    const split = device({ kind: 'thermostat', name: 'Climatisation', raw: { mode: 'cool', currentTempC: 29 } });
    expect(deviceArtwork(split)).toContain('split-cool.webp');
    expect(deviceArtwork({ ...split, raw: { mode: 'heat' } })).toContain('split-heat.webp');
    expect(deviceArtwork({ ...split, raw: { currentTempC: 29 } })).toContain('split-idle.webp');
    expect(thermalMode({ ...split, online: false })).toBe('unknown');
  });
  it('reserves a valid slot for every device on every room illustration', () => {
    for (const slots of Object.values(ROOM_DEVICE_POSITIONS)) for (const [x, y] of Object.values(slots)) {
      expect(x).toBeGreaterThan(0); expect(x).toBeLessThan(100);
      expect(y).toBeGreaterThan(0); expect(y).toBeLessThan(100);
    }
  });
  it('ships each room state and its thumbnail with WebP alpha', () => {
    for (const scene of Object.keys(ROOM_DEVICE_POSITIONS) as (keyof typeof ROOM_DEVICE_POSITIONS)[]) {
      const variants = ['entrance', 'hallway', 'outdoor'].includes(scene) ? ['', 'door-open'] : ['', 'door-open', 'window-open', 'both-open'];
      for (const variant of variants) {
        const path = resolve(process.cwd(), 'public' + roomArtwork(scene, variant as Parameters<typeof roomArtwork>[1]));
        expect(existsSync(path), path).toBe(true);
        const data = readFileSync(path);
        expect(data.subarray(0, 4).toString()).toBe('RIFF');
        // Lossy WebP + alpha is encoded as VP8X with the alpha feature bit.
        expect(data.subarray(12, 16).toString()).toBe('VP8X');
        expect(data[20] & 0x10, path).toBe(0x10);
      }
      expect(existsSync(resolve(process.cwd(), `public/images/connected-rooms/baitly-${scene}-thumb.webp`))).toBe(true);
    }
  });
});
