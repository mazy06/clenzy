import { afterEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/dom';
import { createInitialState, StateManager } from '../state';
import { createBookingI18n } from '../i18n';
import { mountPrimitive, type MountContext } from './mountPrimitive';
import { navigateTo, withReservationReference } from './navigation';

vi.mock('./navigation', async (original) => ({ ...await original<typeof import('./navigation')>(), navigateTo: vi.fn() }));

function fixture(preview = false) {
  const state = new StateManager(createInitialState({ selectedPropertyId: 42, checkIn: '2027-04-10', checkOut: '2027-04-13', pricing: { nightlyRate: 110, nights: 3, subtotal: 330, cleaningFee: 60, addonsTotal: 0, total: 390, currency: 'EUR', lines: [] }, guestForm: { firstName: 'Jean', lastName: 'Test', email: 'jean@example.com', phone: '+33600000000', message: '' } }));
  const api = { submitInquiry: vi.fn().mockResolvedValue({}), reserve: vi.fn().mockResolvedValue({ reservationCode: 'R-42', status: 'CONFIRMED', requiresPayment: false }), reserveBatch: vi.fn().mockResolvedValue({ reservations: [{ reservationCode: 'R-42' }, { reservationCode: 'R-43' }], requiresPayment: true }), checkout: vi.fn(), getConfirmation: vi.fn(), listUpsells: vi.fn().mockResolvedValue([{ offerId: 7, title: 'Transfert aéroport', price: 30, currency: 'EUR' }]), upsellCheckout: vi.fn() };
  const core = { state, api, clearPersisted: vi.fn() };
  const context = { core, i18n: createBookingI18n('fr'), config: {}, preview } as unknown as MountContext;
  const mount = (step: string, attributes: Record<string, string> = {}) => {
    const el = document.createElement('div');
    Object.entries(attributes).forEach(([key, value]) => el.setAttribute(key, value));
    document.body.appendChild(el);
    mountPrimitive(el, step, context);
    return el.shadowRoot ?? el;
  };
  return { state, api, core, mount };
}

afterEach(() => { document.body.replaceChildren(); window.history.replaceState({}, '', '/'); vi.clearAllMocks(); });

describe('Native reservation journey connections', () => {
  it('routes result cards to their own detail page even when the property was already selected', () => {
    const { state, mount } = fixture();
    state.set({ properties: [{ id: 42, name: 'Villa Atlas', photoUrls: [], currency: 'EUR', maxGuests: 4 } as never] });
    const root = mount('booking-property-results', { 'data-clenzy-next': '/logement', 'data-baitly-property-pages': JSON.stringify({ '42': '/logements/42' }) });
    root.querySelector<HTMLElement>('.cb-property-card')!.click();
    expect(navigateTo).toHaveBeenCalledWith('/logements/42?clenzy_property=42');
    root.querySelector<HTMLElement>('.cb-property-card')!.click();
    expect(navigateTo).toHaveBeenCalledTimes(2);
    expect(state.get().selectedPropertyId).toBe(42);
  });

  it('keeps a different selected property in the actual reservation payload', async () => {
    const { state, mount, api } = fixture();
    state.set({ selectedPropertyId: 43 });
    const root = mount('booking-guest-form', { 'data-clenzy-return': '/confirmation' });
    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await waitFor(() => expect(api.reserve).toHaveBeenCalledWith(expect.objectContaining({ propertyId: 43 }), undefined));
  });
  it('removes cloned editor placeholders before hydrating the traveller preview', () => {
    const { mount } = fixture(true);
    const root = mount('booking-price-summary', { class: 'cz-widget-empty cz-widget-invalid', 'data-cz-name': 'Editor placeholder' });
    expect((root as HTMLElement).classList.contains('cz-widget-empty')).toBe(false);
    expect((root as HTMLElement).hasAttribute('data-cz-name')).toBe(false);
  });
  it('submits an inquiry without reserving or charging, then follows its thank-you route', async () => {
    const { mount, api } = fixture();
    const root = mount('booking-inquiry-form', { 'data-clenzy-next': '/merci' });
    expect(root.querySelector('[type=submit]')!.textContent).toBe('Envoyer ma demande');
    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await waitFor(() => expect(navigateTo).toHaveBeenCalledWith('/merci'));
    expect(api.submitInquiry).toHaveBeenCalledWith(expect.objectContaining({ propertyId: 42, email: 'jean@example.com' }));
    expect(api.reserve).not.toHaveBeenCalled();
    expect(api.checkout).not.toHaveBeenCalled();
  });

  it('carries the backend booking reference to the no-payment confirmation', async () => {
    const { mount, api } = fixture();
    const root = mount('booking-guest-form', { 'data-clenzy-return': '/confirmation?lang=fr#details' });
    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await waitFor(() => expect(navigateTo).toHaveBeenCalledWith('/confirmation?lang=fr&reservation=R-42#details'));
    expect(api.reserve).toHaveBeenCalledTimes(1);
    expect(api.checkout).not.toHaveBeenCalled();
    expect(withReservationReference(null, 'R-42')).toBeNull();
  });

  it('keeps Studio form actions inert', () => {
    const { mount, api } = fixture(true);
    for (const widget of ['booking-inquiry-form', 'booking-guest-form']) mount(widget).querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(api.submitInquiry).not.toHaveBeenCalled();
    expect(api.reserve).not.toHaveBeenCalled();
    expect(navigateTo).not.toHaveBeenCalled();
  });

  it('sends cart continuation to the contact page without prematurely creating reservations', () => {
    const { mount, state, api } = fixture();
    state.set({ cart: [{ propertyId: 42, propertyName: 'Duplex', checkIn: '2027-04-10', checkOut: '2027-04-13', guests: 2, children: 0, total: 390, currency: 'EUR' }] });
    const root = mount('booking-cart', { 'data-clenzy-next': '/paiement' });
    root.querySelector<HTMLButtonElement>('.cb-cart__checkout')!.click();
    expect(navigateTo).toHaveBeenCalledWith('/paiement');
    expect(api.reserve).not.toHaveBeenCalled();
    expect(api.checkout).not.toHaveBeenCalled();
  });

  it('navigates inside Studio from the basket to payment without submitting a reservation', () => {
    const { mount, state, api } = fixture(true);
    state.set({ cart: [{ propertyId: 42, propertyName: 'Duplex', checkIn: '2027-04-10', checkOut: '2027-04-13', guests: 2, children: 0, total: 390, currency: 'EUR' }] });
    const navigate = vi.fn();
    document.addEventListener('baitly:navigate', navigate, { once: true });
    const root = mount('booking-cart', { 'data-clenzy-next': '/paiement' });
    root.querySelector<HTMLButtonElement>('.cb-cart__checkout')!.click();
    expect(navigate.mock.calls[0][0].detail.path).toBe('/paiement');
    expect(api.reserve).not.toHaveBeenCalled();
    expect(api.checkout).not.toHaveBeenCalled();
    expect(navigateTo).not.toHaveBeenCalled();
  });

  it('renders actual service offers but requires a reservation before service checkout', async () => {
    const { mount, api } = fixture();
    const offers = mount('booking-addons');
    await waitFor(() => expect(offers.textContent).toContain('Transfert aéroport'));
    expect(offers.querySelector<HTMLButtonElement>('.cb-upsell-card__btn')!.disabled).toBe(true);
    expect(api.upsellCheckout).not.toHaveBeenCalled();
    const preview = fixture(true);
    preview.mount('booking-addons');
    expect(preview.api.listUpsells).not.toHaveBeenCalled();
    expect(preview.api.upsellCheckout).not.toHaveBeenCalled();
  });

  it('keeps every batch reservation reference and does not pay just the first stay', async () => {
    const { mount, state, api } = fixture();
    state.set({ cart: [42, 43].map((id) => ({ propertyId: id, propertyName: `Séjour ${id}`, checkIn: '2027-04-10', checkOut: '2027-04-13', guests: 3, children: 1, total: 390, currency: 'EUR' })) });
    mount('booking-guest-form', { 'data-clenzy-return': '/confirmation' }).querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await waitFor(() => expect(navigateTo).toHaveBeenCalledWith('/confirmation?stay=R-42&stay=R-43&payRemaining=1'));
    expect(api.reserveBatch).toHaveBeenCalledWith(expect.objectContaining({ items: expect.arrayContaining([expect.objectContaining({ propertyId: 42, children: 1 })]) }), undefined);
    expect(api.checkout).not.toHaveBeenCalled();
    expect(state.get().cart).toHaveLength(2);
  });

  it('keeps a partially paid cart open and offers payment only for its unpaid stay', async () => {
    const { mount, api, core } = fixture();
    window.history.replaceState({}, '', '/confirmation?stay=R-42&stay=R-43&payRemaining=1');
    api.getConfirmation.mockImplementation(async (code) => ({ reservationCode: code, propertyName: `Logement ${code}`, status: code === 'R-42' ? 'CONFIRMED' : 'PENDING', paymentStatus: code === 'R-42' ? 'PAID' : 'UNPAID' }));
    const root = mount('booking-confirmation');
    await waitFor(() => expect(root.textContent).toContain('Vos séjours à finaliser'));
    const payments = root.querySelectorAll<HTMLButtonElement>('.cb-cta');
    expect(payments).toHaveLength(1);
    expect(payments[0].textContent).toContain('R-43');
    expect(api.checkout).not.toHaveBeenCalled();
    expect(core.clearPersisted).not.toHaveBeenCalled();
  });

  it('does not claim confirmation or discard the journey when a booking cannot be verified', async () => {
    const { mount, api, core } = fixture();
    const missing = mount('booking-confirmation');
    expect(missing.querySelector('.cb-confirmation__icon')).toHaveProperty('hidden', true);
    expect(api.getConfirmation).not.toHaveBeenCalled();
    window.history.replaceState({}, '', '/confirmation?reservation=R-42');
    api.getConfirmation.mockRejectedValue(new Error('unavailable'));
    const failed = mount('booking-confirmation');
    await waitFor(() => expect(failed.textContent).toContain(createBookingI18n('fr').t('confirmation.unavailable')));
    expect(core.clearPersisted).not.toHaveBeenCalled();
  });

  it('clears persisted journey state only after verified confirmation', async () => {
    const { mount, api, core } = fixture();
    window.history.replaceState({}, '', '/confirmation?reservation=R-42');
    api.getConfirmation.mockResolvedValue({ reservationCode: 'R-42', status: 'PENDING', guests: 2 });
    const pending = mount('booking-confirmation');
    await waitFor(() => expect(pending.textContent).toContain(createBookingI18n('fr').t('confirmation.pending')));
    expect(core.clearPersisted).not.toHaveBeenCalled();
    api.getConfirmation.mockResolvedValue({ reservationCode: 'R-42', status: 'CONFIRMED', guests: 2 });
    const confirmed = mount('booking-confirmation');
    await waitFor(() => expect(core.clearPersisted).toHaveBeenCalledTimes(1));
    expect(confirmed.querySelector('.cb-confirmation__icon')).toHaveProperty('hidden', false);
  });

  it('shows unpaid totals and refreshes verified server data without trusting a paid URL flag', async () => {
    const { mount, api } = fixture();
    window.history.replaceState({}, '', '/confirmation?reservation=R-42&status=paid');
    api.getConfirmation.mockResolvedValue({ reservationCode: 'R-42', propertyName: 'Duplex', status: 'PENDING', paymentStatus: 'PENDING', guests: 3, total: 390.5, currency: 'EUR' });
    const root = mount('booking-confirmation');
    await waitFor(() => expect(root.textContent).toContain('390,50'));
    expect(root.textContent).toContain('En attente de paiement');
    expect(root.querySelector('.cb-confirmation__icon')).toHaveProperty('hidden', true);
    api.getConfirmation.mockResolvedValue({ reservationCode: 'R-42', status: 'CONFIRMED', paymentStatus: 'PAID', total: 390.5, currency: 'EUR' });
    root.querySelector<HTMLButtonElement>('.cb-confirmation__refresh')!.click();
    await waitFor(() => expect(root.querySelector('.cb-confirmation-stay__payment')?.textContent).toContain('Payé'));
    expect(api.getConfirmation).toHaveBeenCalledTimes(2);
    expect(api.checkout).not.toHaveBeenCalled();
  });

  it('does not offer another payment for a refunded or processing stay', async () => {
    const { mount, api } = fixture();
    window.history.replaceState({}, '', '/confirmation?stay=R-42&stay=R-43&payRemaining=1');
    api.getConfirmation.mockImplementation(async (code) => ({ reservationCode: code, status: 'CONFIRMED', paymentStatus: code === 'R-42' ? 'REFUNDED' : 'PROCESSING' }));
    const root = mount('booking-confirmation');
    await waitFor(() => expect(root.textContent).toContain('Remboursé'));
    expect(root.querySelectorAll('.cb-cta')).toHaveLength(0);
    expect(api.checkout).not.toHaveBeenCalled();
  });

  it('uses explicit preview data without reading confirmations or suggesting payment success', () => {
    const { mount, state, api } = fixture(true);
    state.set({ properties: [{ id: 42, name: 'Villa & jardin', currency: 'EUR', priceFrom: 120, cleaningFee: 60 }] as never });
    const root = mount('booking-confirmation');
    expect(root.textContent).toContain('Exemple de confirmation');
    expect(root.textContent).toContain('Villa & jardin');
    expect(root.textContent).toContain('À vérifier');
    expect(root.querySelector('.cb-confirmation__icon')).toHaveProperty('hidden', true);
    expect(api.getConfirmation).not.toHaveBeenCalled();
    expect(api.reserve).not.toHaveBeenCalled();
  });

  it('keeps each verified stay and its own dates, travellers, total and payment state in a batch recap', async () => {
    const { mount, api } = fixture();
    window.history.replaceState({}, '', '/confirmation?stay=R-42&stay=R-43');
    api.getConfirmation.mockImplementation(async (code) => ({ reservationCode: code, propertyName: code === 'R-42' ? 'Villa Jardin' : 'Loft Paris', status: 'CONFIRMED', paymentStatus: code === 'R-42' ? 'PAID' : 'PARTIALLY_PAID', checkIn: code === 'R-42' ? '2027-06-10' : '2027-06-14', checkOut: '2027-06-18', guests: code === 'R-42' ? 4 : 2, total: code === 'R-42' ? 432.5 : 650, currency: code === 'R-42' ? 'EUR' : 'MAD' }));
    const root = mount('booking-confirmation');
    await waitFor(() => expect(root.querySelectorAll('.cb-confirmation__stay-group')).toHaveLength(2));
    const stays = root.querySelectorAll('.cb-confirmation__stay-group');
    expect(stays[0].textContent).toContain('Villa Jardin');
    expect(stays[0].textContent).toContain('10 juin 2027');
    expect(stays[0].textContent).toContain('Voyageurs4');
    expect(stays[0].textContent).toContain('432,50');
    expect(stays[1].textContent).toContain('Loft Paris');
    expect(stays[1].textContent).toContain('14 juin 2027');
    expect(stays[1].textContent).toContain('Voyageurs2');
    expect(stays[1].textContent).toContain('Acompte payé, solde dû');
    expect(stays[1].textContent).toContain('650,00');
  });
});
