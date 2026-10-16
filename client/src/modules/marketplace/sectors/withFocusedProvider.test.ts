import { describe, expect, it } from 'vitest';
import type { SectorMap } from '../../../services/api/sectorMapApi';
import { withFocusedProvider } from './withFocusedProvider';

const provider = (providerId: number, userId: number | null) =>
  ({ providerId, name: `P${providerId}`, avatarUrl: null, geometry: null, zones: [], userId });

const relevant: SectorMap = {
  providers: [provider(1, 10)],
  merged: null,
  properties: [{ id: 5, name: 'Loft', latitude: 48.8, longitude: 2.3, coveredBy: [1] }],
  attribution: '',
};

describe('withFocusedProvider', () => {
  it('ajoute le prestataire absent en fin de liste et compte ce qu’il couvre', () => {
    const focused: SectorMap = { ...relevant, providers: [provider(9, 42)],
      properties: [{ id: 5, name: 'Loft', latitude: 48.8, longitude: 2.3, coveredBy: [9] }] };

    const merged = withFocusedProvider(relevant, focused);

    expect(merged.providers.map((p) => p.providerId)).toEqual([1, 9]);
    expect(merged.properties[0].coveredBy).toEqual([1, 9]);
  });

  it('ne change rien quand le prestataire est déjà listé ou inconnu', () => {
    expect(withFocusedProvider(relevant, { ...relevant })).toBe(relevant);
    expect(withFocusedProvider(relevant, undefined)).toBe(relevant);
  });
});
