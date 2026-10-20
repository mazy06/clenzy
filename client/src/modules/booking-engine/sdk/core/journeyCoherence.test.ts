import { afterEach, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/dom';
import { BaitlyBookingCore } from './BaitlyBookingCore';
import type { ApiAvailability, ApiProperty } from '../api';

const cores: BaitlyBookingCore[] = [];
afterEach(() => { cores.forEach((core) => core.destroy()); cores.length = 0; sessionStorage.clear(); window.history.replaceState({}, '', '/'); });
const quote = (id: number, total: number) => ({ available: true, propertyId: id, nights: 3, subtotal: total - 60, cleaningFee: 60, touristTax: 0, total, currency: 'EUR', breakdown: [], violations: [] } as unknown as ApiAvailability);

function fixture(persist = false) {
  const core = new BaitlyBookingCore({ apiKey: 'coherence-test', baseUrl: window.location.origin, persist, defaults: { selectedPropertyId: 41, checkIn: '2027-06-10', checkOut: '2027-06-13' } });
  cores.push(core);
  vi.spyOn(core.api, 'getCurrencies').mockResolvedValue(['EUR', 'USD']);
  vi.spyOn(core.api, 'getSearchFilters').mockResolvedValue({} as never);
  vi.spyOn(core.api, 'getProperties').mockResolvedValue([41, 42].map((id) => ({ id, name: `Logement ${id}`, currency: 'EUR', photoUrls: [] } as unknown as ApiProperty)));
  vi.spyOn(core.api, 'getCalendar').mockResolvedValue({ days: [] } as never);
  vi.spyOn(core.api, 'getPriceCalendar').mockResolvedValue({ days: [] } as never);
  const availability = vi.spyOn(core.api, 'checkAvailability').mockImplementation(async (request) => quote(request.propertyId, request.propertyId === 41 ? 360.5 : 510.75));
  return { core, availability };
}

it('restores the stay across page reloads and recalculates its quote instead of restoring a stale price', async () => {
  const first = fixture(true);
  first.core.start();
  await waitFor(() => expect(first.core.state.get().pricing?.total).toBe(360.5));
  first.core.state.set({ adults: 3, children: 1, infants: 1, selectedPropertyId: 42 });
  await waitFor(() => expect(first.core.state.get().pricing?.total).toBe(510.75));
  first.core.destroy();
  window.history.replaceState({}, '', '/reserver?clenzy_property=42');
  const next = fixture(true);
  expect(next.core.state.get()).toMatchObject({ selectedPropertyId: 42, checkIn: '2027-06-10', checkOut: '2027-06-13', adults: 3, children: 1, infants: 1, pricing: null });
  next.core.start();
  await waitFor(() => expect(next.core.state.get().pricing?.total).toBe(510.75));
  expect(next.availability).toHaveBeenCalledWith(expect.objectContaining({ propertyId: 42, guests: 4, children: 1 }), 'EUR', undefined);
});

it('re-quotes when the adult/child split changes even when the total number of guests is unchanged', async () => {
  const { core, availability } = fixture();
  core.start();
  await waitFor(() => expect(core.state.get().pricing).not.toBeNull());
  core.state.set({ adults: 1, children: 1 });
  await waitFor(() => expect(availability).toHaveBeenCalledTimes(2));
  expect(availability.mock.lastCall?.[0]).toMatchObject({ guests: 2, children: 1 });
});

it('discards out-of-order prices and invalidates the old quote immediately during a property change', async () => {
  const { core, availability } = fixture();
  let resolveOld!: (value: ApiAvailability) => void;
  availability.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
  core.start();
  await waitFor(() => expect(availability).toHaveBeenCalledTimes(1));
  core.state.set({ selectedPropertyId: 42 });
  expect(core.state.get().pricing).toBeNull();
  await waitFor(() => expect(core.state.get().pricing?.total).toBe(510.75));
  resolveOld(quote(41, 999));
  await Promise.resolve();
  expect(core.state.get().pricing?.total).toBe(510.75);
});

it('clears the quote after invalid dates or an availability error instead of retaining a bookable old price', async () => {
  const { core, availability } = fixture();
  core.start();
  await waitFor(() => expect(core.state.get().pricing).not.toBeNull());
  availability.mockRejectedValueOnce(new Error('Unavailable'));
  core.state.set({ adults: 3 });
  await waitFor(() => expect(core.state.get().error).toBe('Unavailable'));
  expect(core.state.get().pricing).toBeNull();
  core.state.set({ checkOut: '2027-06-09' }, 'dateSelected');
  expect(core.state.get().pricing).toBeNull();
  expect(core.state.get().pricingLoading).toBe(false);
});
