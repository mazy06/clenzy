import { afterEach, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/dom';
import { BaitlyBookingCore } from '../core/BaitlyBookingCore';
import { mountPrimitive, type MountContext } from './mountPrimitive';
import { navigateTo } from './navigation';
import { BAITLY_JOURNEY_TEMPLATES, materializeBaitlyJourneyTemplate } from '../../studio/grapes/import/baitlyJourneyTemplates';
import type { ApiAvailability, ApiConfirmation, ApiProperty } from '../api';

vi.mock('./navigation', async (original) => ({ ...await original<typeof import('./navigation')>(), navigateTo: vi.fn() }));
const properties = [
  { id: 41, name: 'Maison du jardin avec une longue adresse et une grande terrasse', city: 'Nice', nightlyPrice: 120.5, priceFrom: 120.5, cleaningFee: 60, cleaningBasePrice: 60, currency: 'EUR', maxGuests: 8, photoUrls: ['https://images.example/41.jpg'], bookingEngineVisible: true },
  { id: 42, name: 'Appartement Paris avec une chambre indépendante', city: 'Paris', nightlyPrice: 180.75, priceFrom: 180.75, cleaningFee: 80, cleaningBasePrice: 80, currency: 'EUR', maxGuests: 6, photoUrls: ['https://images.example/42.jpg'], bookingEngineVisible: true },
];
const cores: BaitlyBookingCore[] = [];
afterEach(() => { cores.forEach((core) => core.destroy()); cores.length = 0; document.body.replaceChildren(); sessionStorage.clear(); window.history.replaceState({}, '', '/'); vi.clearAllMocks(); });

it.each(BAITLY_JOURNEY_TEMPLATES)('preserves the actual $name journey from its entry page to its server confirmation', async (master) => {
  const template = materializeBaitlyJourneyTemplate(master, properties[0], false, properties);
  const core = new BaitlyBookingCore({ apiKey: `matrix-${master.id}`, baseUrl: window.location.origin, persist: false, defaults: { selectedPropertyId: 41, guestForm: { firstName: 'Alice', lastName: 'Test', email: 'alice@example.com', phone: '+33600000000', message: '' } } });
  cores.push(core);
  const records = new Map<string, ApiConfirmation>();
  const price = (stay: { propertyId: number; checkIn: string; checkOut: string; guests: number; children?: number }) => {
    const property = properties.find((p) => p.id === stay.propertyId)!;
    const nights = (Date.parse(stay.checkOut) - Date.parse(stay.checkIn)) / 86400000;
    const subtotal = property.priceFrom * nights;
    const touristTax = (stay.guests - (stay.children || 0)) * nights * 4.25;
    return { available: true, ...stay, nights, subtotal, cleaningFee: property.cleaningFee, touristTax, total: subtotal + property.cleaningFee + touristTax, currency: 'EUR', breakdown: [], violations: [] } as unknown as ApiAvailability;
  };
  const record = (stay: Parameters<typeof price>[0]) => {
    const quote = price(stay);
    const property = properties.find((p) => p.id === stay.propertyId)!;
    const reservationCode = `TEST-${records.size + 1}`;
    records.set(reservationCode, { ...quote, reservationCode, propertyName: property.name, propertyCity: property.city, status: 'CONFIRMED', paymentStatus: 'NOT_REQUIRED', guestName: null, guestEmail: null, checkInTime: '16:00', checkOutTime: '11:00' });
    return { reservationCode, status: 'CONFIRMED', total: quote.total, currency: quote.currency, requiresPayment: false };
  };
  vi.spyOn(core.api, 'getCurrencies').mockResolvedValue(['EUR']);
  vi.spyOn(core.api, 'getSearchFilters').mockResolvedValue({ propertyTypes: [], amenities: [], priceMin: 0, priceMax: 500, maxBedrooms: 4, maxBathrooms: 3, maxGuests: 8, currency: 'EUR' });
  vi.spyOn(core.api, 'getProperties').mockResolvedValue(properties as unknown as ApiProperty[]);
  vi.spyOn(core.api, 'getCalendar').mockResolvedValue({ days: [] } as never);
  vi.spyOn(core.api, 'getPriceCalendar').mockResolvedValue({ days: [] } as never);
  vi.spyOn(core.api, 'checkAvailability').mockImplementation(async (stay) => price(stay));
  const reserve = vi.spyOn(core.api, 'reserve').mockImplementation(async (stay) => record(stay) as never);
  const batch = vi.spyOn(core.api, 'reserveBatch').mockImplementation(async ({ items }) => ({ reservations: items.map(record), requiresPayment: false }) as never);
  const inquiry = vi.spyOn(core.api, 'submitInquiry').mockResolvedValue({} as never);
  vi.spyOn(core.api, 'listUpsells').mockResolvedValue([]);
  vi.spyOn(core.api, 'getConfirmation').mockImplementation(async (code) => { if (!records.has(code)) throw new Error('Unknown reference'); return records.get(code)!; });
  const checkout = vi.spyOn(core.api, 'checkout').mockRejectedValue(new Error('Payments disabled in tests'));
  const ctx = { core, i18n: core.i18n, config: { baseUrl: window.location.origin }, preview: false } as unknown as MountContext;
  const render = (path: string) => {
    const url = new URL(path, window.location.origin);
    window.history.replaceState({}, '', `${url.pathname}${url.search}`);
    const page = template.pages.find((entry) => entry.path === url.pathname)!;
    expect(page, `${master.name}: ${path}`).toBeDefined();
    document.body.innerHTML = page.html;
    document.querySelectorAll<HTMLElement>('[data-clenzy-widget]').forEach((marker) => mountPrimitive(marker, marker.dataset.clenzyWidget!, ctx));
  };
  const choose = async (propertyId: number, checkIn: string, checkOut: string, adults: number, children: number) => {
    core.state.set({ selectedPropertyId: propertyId, checkIn, checkOut, adults, children }, 'dateSelected');
    await waitFor(() => expect(core.state.get().pricingLoading).toBe(false));
    await waitFor(() => expect(core.state.get().pricing?.total).toBe(price({ propertyId, checkIn, checkOut, guests: adults + children, children }).total));
  };
  const submit = async () => {
    await waitFor(() => expect(document.querySelector<HTMLButtonElement>('[data-clenzy-widget="booking-guest-form"] [type="submit"]')!.disabled).toBe(false));
    document.querySelector<HTMLFormElement>('[data-clenzy-widget="booking-guest-form"] form')!.dispatchEvent(new Event('submit', { cancelable: true }));
  };
  core.start();
  await waitFor(() => expect(core.state.get().properties).toHaveLength(2));
  await choose(41, '2027-06-10', '2027-06-13', 3, 1);
  render('/');

  if (master.journeyId === 'confirmation') {
    const booking = record({ propertyId: 41, checkIn: '2027-06-10', checkOut: '2027-06-13', guests: 4, children: 1 });
    render(`/?reservation=${booking.reservationCode}`);
  } else if (master.journeyId === 'inquiry') {
    document.querySelector<HTMLFormElement>('[data-clenzy-widget="booking-inquiry-form"] form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await waitFor(() => expect(inquiry).toHaveBeenCalled());
    expect(inquiry.mock.lastCall?.[0]).toMatchObject({ propertyId: 41, checkIn: '2027-06-10', checkOut: '2027-06-13', guests: 4 });
    expect(reserve).not.toHaveBeenCalled();
    expect(checkout).not.toHaveBeenCalled();
    return;
  } else {
    if (['catalogue', 'cart', 'extras'].includes(master.journeyId!)) {
      document.querySelector<HTMLButtonElement>('[data-clenzy-widget="booking-search-button"] button')!.click();
      expect(navigateTo).toHaveBeenLastCalledWith('/logements');
      render('/logements');
      [...document.querySelectorAll<HTMLButtonElement>('.cb-property-card')].find((card) => card.textContent?.includes(properties[1].name))!.click();
      await waitFor(() => expect(core.state.get().pricing?.total).toBe(price({ propertyId: 42, checkIn: '2027-06-10', checkOut: '2027-06-13', guests: 4, children: 1 }).total));
      const target = vi.mocked(navigateTo).mock.lastCall![0]!;
      expect(target).toContain('clenzy_property=42');
      render(target);
      if (master.journeyId !== 'extras') {
        const continueLink = document.querySelector<HTMLAnchorElement>('.bt-detail-continue')!;
        expect(continueLink.search).toBe('?clenzy_property=42');
        render(`${continueLink.pathname}${continueLink.search}`);
      }
    } else if (master.journeyId === 'single') render('/reserver');

    if (master.journeyId === 'cart') {
      const firstTotal = core.state.get().pricing!.total;
      document.querySelector<HTMLButtonElement>('[data-clenzy-widget="booking-add-to-cart"] button')!.click();
      expect(core.state.get().cart[0]).toMatchObject({ propertyId: 42, guests: 4, children: 1, total: firstTotal });
      expect(core.state.get()).toMatchObject({ selectedPropertyId: 42, checkIn: null, checkOut: null });
      await choose(41, '2027-06-15', '2027-06-19', 2, 0);
      document.querySelector<HTMLButtonElement>('[data-clenzy-widget="booking-add-to-cart"] button')!.click();
      expect(core.state.get().cart).toHaveLength(2);
      document.querySelector<HTMLButtonElement>('.cb-cart__checkout')!.click();
      expect(navigateTo).toHaveBeenLastCalledWith('/paiement');
      render('/paiement');
      await submit();
      await waitFor(() => expect(batch).toHaveBeenCalledTimes(1));
      expect(batch.mock.lastCall?.[0].items).toEqual([
        { propertyId: 42, checkIn: '2027-06-10', checkOut: '2027-06-13', guests: 4, children: 1 },
        { propertyId: 41, checkIn: '2027-06-15', checkOut: '2027-06-19', guests: 2, children: 0 },
      ]);
    } else {
      const selected = core.state.get().selectedPropertyId;
      await submit();
      await waitFor(() => expect(reserve).toHaveBeenCalledTimes(1));
      expect(reserve.mock.lastCall?.[0]).toMatchObject({ propertyId: selected, checkIn: '2027-06-10', checkOut: '2027-06-13', guests: 4, children: 1 });
    }
    await waitFor(() => expect(vi.mocked(navigateTo).mock.lastCall?.[0]).toContain('/confirmation?'));
    render(vi.mocked(navigateTo).mock.lastCall![0]!);
  }
  await waitFor(() => expect(document.querySelectorAll('.cb-confirmation__stay-group')).toHaveLength(records.size));
  const stays = [...document.querySelectorAll('.cb-confirmation__stay-group')];
  [...records.values()].forEach((booking, index) => {
    expect(stays[index].textContent).toContain(booking.propertyName);
    expect(stays[index].textContent).toContain(`Voyageurs${booking.guests}`);
    expect(stays[index].textContent).toContain(new Intl.NumberFormat('fr', { style: 'currency', currency: booking.currency }).format(booking.total));
    expect(stays[index].textContent).toContain('Paiement en ligne non requis');
  });
  expect(checkout).not.toHaveBeenCalled();
});
