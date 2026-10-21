import { afterEach, describe, expect, it } from 'vitest';
import { BaitlyBookingCore } from './BaitlyBookingCore';
import { withPropertySelection } from '../primitives/navigation';

afterEach(() => { window.history.replaceState({}, '', '/'); sessionStorage.clear(); });

describe('Property selection across booking pages', () => {
  it('uses the dedicated page property instead of an older persisted selection or conflicting query', () => {
    const options = { apiKey: 'property-navigation-test', baseUrl: window.location.origin };
    const first = new BaitlyBookingCore(options);
    first.state.set({ selectedPropertyId: 42 });
    first.destroy();
    window.history.replaceState({}, '', '/logements/43?clenzy_property=42');
    const detail = new BaitlyBookingCore(options);
    expect(detail.state.get().selectedPropertyId).toBe(43);
    detail.destroy();
    window.history.replaceState({}, '', '/reserver?clenzy_property=43');
    const reservation = new BaitlyBookingCore(options);
    expect(reservation.state.get().selectedPropertyId).toBe(43);
    reservation.destroy();
  });

  it('keeps existing route options when carrying a property to the cart journey', () => {
    expect(withPropertySelection('/sejour?lang=fr#dates', 43)).toBe('/sejour?lang=fr&clenzy_property=43#dates');
  });
});
