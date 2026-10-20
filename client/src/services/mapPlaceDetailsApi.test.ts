import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchMapPlaceDetails, matchMapPlace, safePlaceWebsite } from './mapPlaceDetailsApi';

afterEach(() => vi.unstubAllGlobals());

const place = { name: 'Café de test', kind: 'restaurant', lat: 48.869, lng: 2.331 };
const element = { type: 'node', id: 123, lat: 48.869, lon: 2.331, tags: {
  name: 'Café de test', amenity: 'restaurant', 'addr:housenumber': '12', 'addr:street': 'rue de Test', 'addr:city': 'Paris',
  'contact:phone': '+33 1 23 45 67 89', website: 'https://example.org/menu', opening_hours: 'Mo-Fr 09:00-18:00',
  wikimedia_commons: 'File:Cafe test.jpg',
} };

describe('map place details', () => {
  it('loads public details from the existing geocoder with a bounded search', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify([{ osm_type: 'node', osm_id: 123,
      name: place.name, lat: String(place.lat), lon: String(place.lng), extratags: element.tags,
      address: { house_number: '12', road: 'rue de Test', city: 'Paris' } }]), { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    expect(await fetchMapPlaceDetails(place)).toMatchObject({ website: 'https://example.org/menu', address: '12 rue de Test, Paris' });
    expect(fetch).toHaveBeenCalledTimes(1);
    const request = new URL(fetch.mock.calls[0][0]);
    expect(request.hostname).toBe('nominatim.openstreetmap.org');
    expect(request.searchParams.get('bounded')).toBe('1');
  });
  it('matches a public place by name and location, maps real tags and attributes its photo', () => {
    expect(matchMapPlace(place, [element])).toMatchObject({ address: '12 rue de Test, Paris',
      phone: '+33 1 23 45 67 89', website: 'https://example.org/menu', openingHours: 'Mo-Fr 09:00-18:00',
      sourceUrl: 'https://www.openstreetmap.org/node/123', photo: { sourceUrl: 'https://commons.wikimedia.org/wiki/File%3ACafe%20test.jpg' } });
  });
  it('does not substitute a nearby restaurant or the same name in another city', () => {
    expect(matchMapPlace(place, [{ ...element, tags: { name: 'Autre café' } }])).toBeNull();
    expect(matchMapPlace(place, [{ ...element, lat: 45 }])).toBeNull();
  });
  it('keeps absent information absent and rejects unsafe links and remote images', () => {
    expect(matchMapPlace(place, [{ ...element, tags: { name: place.name, website: 'javascript:alert(1)', image: 'https://untrusted.example/photo.jpg' } }])).toMatchObject({ website: undefined, photo: undefined, openingHours: undefined });
    for (const value of ['http://example.org', 'https://localhost/', 'https://127.0.0.1/', 'https://10.0.0.1', 'https://[::1]/', 'https://user:password@example.org', 'https://service.local']) expect(safePlaceWebsite(value)).toBeUndefined();
  });
});
