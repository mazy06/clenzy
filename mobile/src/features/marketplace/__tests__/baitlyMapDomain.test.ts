import { baitlyDemoProviders } from '../baitlyDemoCatalog';
import { mapScriptJson, providerMapPoint, selectedMapIds, validMapPosition } from '../baitlyMapDomain';
import { baitlyProviderMapPayload, baitlyProviderMapUrl } from '../baitlyMapBridge';

describe('Baitly provider map', () => {
  it('uses explicit synthetic coordinates only for demo profiles', () => {
    const demo = baitlyDemoProviders[0];
    expect(providerMapPoint(demo, {})?.latitude).toBe(demo.demoPosition?.latitude);
    const real = { ...demo, id: 63, demo: false };
    expect(providerMapPoint(real, {})).toBeNull();
    expect(providerMapPoint(real, { 'Marrakech|MA': { latitude: 31.63, longitude: -8 } })?.latitude).toBe(31.63);
  });
  it('does not invent coverage or accept invalid coordinates and radii', () => {
    expect(validMapPosition({ latitude: 91, longitude: -8 })).toBe(false);
    expect(validMapPosition({ latitude: NaN, longitude: -8 })).toBe(false);
    expect(providerMapPoint({ ...baitlyDemoProviders[0], travelRadiusKm: -1 }, {})?.radiusKm).toBeNull();
    expect(providerMapPoint({ ...baitlyDemoProviders[0], travelRadiusKm: 9000 }, {})?.radiusKm).toBeNull();
    expect(providerMapPoint({ ...baitlyDemoProviders[0], travelRadiusKm: null }, {})?.radiusKm).toBeNull();
  });
  it('only selects known provider IDs received from the map', () => {
    const point = providerMapPoint(baitlyDemoProviders[0], {})!;
    expect(selectedMapIds(JSON.stringify({ type: 'select', ids: [-1, -1, 999, '<script>'] }), [point])).toEqual([-1]);
    expect(selectedMapIds('invalid', [point])).toEqual([]);
    expect(selectedMapIds('{"type":"other","ids":[-1]}', [point])).toEqual([]);
  });
  it('escapes script payloads and respects reduced motion', () => {
    expect(mapScriptJson('</script><script>alert(1)</script>')).not.toContain('<');
    const payload = baitlyProviderMapPayload([], { map: '</script>', pin: 'Prestataire' }, true);
    expect(payload).not.toContain('</script>');
    expect(payload).toContain('"reduced":true');
    expect(baitlyProviderMapUrl('ar-MA', true)).toContain('/baitly-provider-map.html?lang=ar&theme=dark');
  });
});
