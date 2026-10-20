import { afterEach, expect, it } from 'vitest';
import { createInitialState, StateManager } from '../state';
import { createBookingI18n } from '../i18n';
import { createSingleSelect } from './FilterPanel';
import { createGuestSelector } from './GuestSelector';
import { createCalendar } from './Calendar';
import { createDatePicker } from './DatePicker';
import { createPriceSummary } from './PriceSummary';
import { createGuestForm } from './GuestForm';
import { createPropertyList } from './PropertyList';
import { createCartList } from './CartList';
import { createStaySummary } from './StaySummary';
import type { PriceBreakdown, WidgetProperty } from '../types';

afterEach(() => document.body.replaceChildren());

it('opens the calendar on the restored arrival month without resetting the stay', () => {
  const state = new StateManager(createInitialState({ checkIn: '2027-06-10', checkOut: '2027-06-13', calendarBaseMonth: '2027-01' }));
  const dates = createDatePicker(state, createBookingI18n('fr'));
  dates.querySelector<HTMLButtonElement>('.cb-date-input')!.click();
  expect(state.get()).toMatchObject({ checkIn: '2027-06-10', checkOut: '2027-06-13', calendarBaseMonth: '2027-06', calendarOpen: true });
});

it('keeps currencies separate in the cart and displays children in each stay', () => {
  const stay = { propertyId: 1, propertyName: 'Villa', checkIn: '2027-06-10', checkOut: '2027-06-13', guests: 4, children: 2, total: 450, currency: 'EUR' };
  const state = new StateManager(createInitialState({ cart: [stay, { ...stay, currency: 'MAD', total: 3000 }] }));
  const cart = createCartList(state, createBookingI18n('fr'), () => {});
  const totals = [...cart.querySelectorAll('.cb-cart__total')].map((row) => row.textContent);
  expect(totals).toHaveLength(2);
  expect(totals[0]).toContain('450');
  expect(totals[1]).toContain('3,000');
  expect(cart.textContent).not.toContain('3,450');
  expect(cart.querySelector('.cb-cart__guests')?.textContent).toContain('2 Enfants');
});

it('updates the read-only recap when dates, travellers, quote or selected property change', () => {
  const state = new StateManager(createInitialState({ properties: [{ id: 1, name: 'Villa <Jardin>', city: 'Fès', mainPhotoUrl: '/photo.jpg' }, { id: 2, name: 'Loft Paris' }] as WidgetProperty[], selectedPropertyId: 1 }));
  const recap = createStaySummary(state, 'https://booking.example', createBookingI18n('fr'));
  expect(recap.querySelector('h3')?.textContent).toBe('Villa <Jardin>');
  expect(recap.querySelector('h3')?.children).toHaveLength(0);
  expect(recap.querySelector('img')?.src).toBe('https://booking.example/photo.jpg');
  state.set({ checkIn: '2027-06-10', checkOut: '2027-06-13', adults: 3, children: 1, infants: 1, pricing: { total: 345, currency: 'EUR', lines: [] } as unknown as PriceBreakdown });
  expect(recap.textContent).toContain('10 juin 2027');
  expect(recap.textContent).toContain('3 Adultes · 1 Enfants · 1 Bébés');
  expect(recap.textContent).toContain('345');
  state.set({ selectedPropertyId: 2 });
  expect(recap.querySelector('h3')?.textContent).toBe('Loft Paris');
});

it('keeps multi-stay names and dates separate, refreshes changed prices and explains an empty cart', () => {
  const name = 'La grande maison familiale du jardin des voyageurs, terrasse et dépendance';
  const item = { propertyId: 1, propertyName: name, checkIn: '2027-06-10', checkOut: '2027-06-13', guests: 4, children: 0, total: 450, currency: 'EUR' };
  const state = new StateManager(createInitialState({ cart: [item] }));
  const cart = createCartList(state, createBookingI18n('fr'), () => {});
  expect(cart.querySelector('.cb-cart__property-name')?.textContent).toBe(name);
  expect(cart.querySelector('.cb-cart__dates')?.textContent).toContain('13 juin 2027');
  expect(cart.querySelector('.cb-cart__guests')?.textContent).toContain('4 voyageurs');
  state.set({ cart: [{ ...item, total: 750 }] });
  expect(cart.querySelector('.cb-cart__total')?.textContent).toContain('750');
  cart.querySelector<HTMLButtonElement>('.cb-cart__remove')!.click();
  expect(cart.querySelector('[role=status]')?.textContent).toBe('Votre panier est vide.');
  expect(cart.querySelector('.cb-cart__checkout')).toBeNull();
});

it('shows an already-calculated price immediately without losing long fee labels', () => {
  const label = 'Ménage de fin de séjour et préparation du logement pour les prochains voyageurs';
  const state = new StateManager(createInitialState({ checkIn: '2027-06-10', checkOut: '2027-06-13', pricing: { lines: [{ type: 'cleaning', label, amount: 45 }], total: 345, currency: 'EUR' } as PriceBreakdown }));
  const summary = createPriceSummary(state, createBookingI18n('fr'));
  expect(summary.querySelector('.cb-price-line__label')?.textContent).toBe(label);
  expect(summary.querySelector('.cb-price-total')?.textContent).toContain('345');
});

it('retains restored guest values and connects validation errors to their fields', () => {
  const state = new StateManager(createInitialState({ guestForm: { firstName: 'Alice', lastName: 'Martin', email: 'alice@example.com', phone: '', message: 'Arrivée tardive' } }));
  const form = createGuestForm(state, createBookingI18n('fr'), () => {});
  expect(form.querySelector<HTMLInputElement>('[autocomplete=given-name]')?.value).toBe('Alice');
  expect(form.querySelector<HTMLTextAreaElement>('textarea')?.value).toBe('Arrivée tardive');
  state.set({ guestFormErrors: { email: 'Adresse e-mail incorrecte' } });
  const email = form.querySelector<HTMLInputElement>('[type=email]')!;
  expect(email.getAttribute('aria-invalid')).toBe('true');
  expect(form.querySelector(`#${email.getAttribute('aria-describedby')}`)?.textContent).toBe('Adresse e-mail incorrecte');
});

it('preserves complete property names and explains an empty filtered result', () => {
  const name = 'La maison des voyageurs au bord de la Méditerranée avec terrasse et jardin';
  const state = new StateManager(createInitialState({ properties: [{ id: 1, name, city: 'Nice', maxGuests: 6, bedroomCount: 3, priceFrom: 120 } as WidgetProperty] }));
  const list = createPropertyList(state, createBookingI18n('fr'), '', { direction: 'row' });
  expect(list.querySelector('.cb-property-card__name')?.textContent).toBe(name);
  expect(list.querySelector('.cb-property-card__facts')?.textContent).toContain('6 voyageurs');
  state.set({ destination: 'Bordeaux' });
  expect(list.querySelector('[role=status]')?.textContent).toContain('Aucun hébergement');
});

it('lets a keyboard user choose a type and returns focus to the trigger', () => {
  const state = new StateManager(createInitialState());
  let value = '';
  const select = createSingleSelect(state, { getOptions: () => [{ value: '', label: 'Tous' }, { value: 'villa', label: 'Villa' }], getValue: () => value, setValue: (v) => { value = v; } });
  document.body.append(select);
  const trigger = select.querySelector<HTMLButtonElement>('.cb-input')!;
  const panel = select.querySelector<HTMLElement>('[role=listbox]')!;
  expect(panel.hidden).toBe(true);
  trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  expect(panel.hidden).toBe(false);
  expect(document.activeElement?.textContent).toBe('Tous');
  document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  (document.activeElement as HTMLButtonElement).click();
  expect(value).toBe('villa');
  expect(panel.hidden).toBe(true);
  expect(document.activeElement).toBe(trigger);
  expect(trigger.getAttribute('aria-expanded')).toBe('false');
});

it('closes the calendar with Escape and removes closed days from keyboard navigation', () => {
  const state = new StateManager(createInitialState());
  const i18n = createBookingI18n('fr');
  const host = document.createElement('div');
  host.className = 'cb-wdates';
  host.append(createDatePicker(state, i18n), createCalendar(state, i18n, 'EUR'));
  document.body.append(host);
  host.querySelector<HTMLButtonElement>('.cb-date-input')!.click();
  const calendar = host.querySelector<HTMLElement>('[role=dialog]')!;
  expect(calendar.hidden).toBe(false);
  calendar.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  expect(calendar.hidden).toBe(true);
  expect(document.activeElement).toBe(host.querySelector('.cb-date-input'));
});

it('keeps all three traveller counters available and restores focus on dismissal', () => {
  const state = new StateManager(createInitialState());
  const host = createGuestSelector(state, createBookingI18n('fr'), 10);
  document.body.append(host);
  const trigger = host.querySelector<HTMLButtonElement>('.cb-guests-toggle')!;
  trigger.click();
  const panel = host.querySelector<HTMLElement>('.cb-guests-panel')!;
  expect(panel.hidden).toBe(false);
  expect(panel.querySelectorAll('.cb-guests-row')).toHaveLength(3);
  panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  expect(panel.hidden).toBe(true);
  expect(document.activeElement).toBe(trigger);
});
