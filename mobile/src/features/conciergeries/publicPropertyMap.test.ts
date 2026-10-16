import { publicHomeMapPins, publicMapHomes } from './publicPropertyMap';
import type { PublicClient } from './publicProfiles';

describe('public home map privacy', () => {
  it('uses city sectors and discards exact coordinates and addresses', () => {
    const clients = [{ id: 'owner', properties: [
      { id: 'home', name: 'Maison', city: ' Lyon ', latitude: 45.12345, longitude: 4.12345, address: 'Private street' },
      { id: 'missing', name: 'Private home', city: '' },
    ] }] as unknown as PublicClient[];
    const pins = publicHomeMapPins(publicMapHomes(clients));
    expect(pins).toHaveLength(1);
    expect(pins[0]).toMatchObject({ baseCity: 'Lyon', travelRadiusKm: 3, coverageCities: [] });
    expect(pins[0]).not.toHaveProperty('latitude');
    expect(pins[0]).not.toHaveProperty('longitude');
    expect(pins[0]).not.toHaveProperty('demoPosition');
    expect(JSON.stringify(pins)).not.toContain('Private street');
  });
  it('keeps each home selectable, including homes sharing the same city', () => {
    const clients = [{ id: 'a', properties: [{ id: '1', name: 'A', city: 'Lyon' }] },
      { id: 'b', properties: [{ id: '1', name: 'B', city: 'Lyon' }] }] as PublicClient[];
    const homes = publicMapHomes(clients);
    expect(homes.map(home => home.id)).toEqual([1, 2]);
    expect(homes[1].client.id).toBe('b');
    expect(publicHomeMapPins(homes).map(pin => pin.baseCity)).toEqual(['Lyon', 'Lyon']);
  });
});
