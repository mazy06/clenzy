import { describe, expect, it } from 'vitest';
import { directionsLinks } from '../directions';

describe('directionsLinks', () => {
  it('whenCoordinatesKnown_thenEveryAppTargetsThePoint', () => {
    const links = directionsLinks({ lat: 48.8589, lng: 2.3622, address: '8 rue des Rosiers' });

    expect(links).toEqual({
      appleMaps: 'https://maps.apple.com/?daddr=48.8589,2.3622',
      googleMaps: 'https://www.google.com/maps/dir/?api=1&destination=48.8589,2.3622',
      waze: 'https://waze.com/ul?ll=48.8589,2.3622&navigate=yes',
    });
  });

  it('whenOnlyAddressKnown_thenAddressIsEncoded', () => {
    const links = directionsLinks({ address: '8 rue des Rosiers, Paris' });

    expect(links?.waze).toBe('https://waze.com/ul?q=8%20rue%20des%20Rosiers%2C%20Paris&navigate=yes');
    expect(links?.appleMaps).toBe('https://maps.apple.com/?daddr=8%20rue%20des%20Rosiers%2C%20Paris');
  });

  it('whenNothingToTarget_thenNoLinks', () => {
    expect(directionsLinks({ address: '  ' })).toBeNull();
    expect(directionsLinks({ lat: null, lng: 2 })).toBeNull();
  });
});
