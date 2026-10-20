import { expect, it } from 'vitest';
import { appendConfirmationStay } from './ConfirmationStay';
import { createBookingI18n } from '../i18n';
import type { ApiConfirmation } from '../api';

const booking = { reservationCode: 'R-42', propertyName: 'La très grande maison <Jardin> avec terrasse pour les voyageurs', propertyCity: 'Marrakech', status: 'CONFIRMED', paymentStatus: 'PARTIALLY_PAID', checkIn: '2027-06-10', checkOut: '2027-06-13', checkInTime: '16:00', checkOutTime: '11:00', guests: 4, nights: 3, subtotal: 360.5, cleaningFee: 60, touristTax: 12, total: 432.5, currency: 'EUR' } as ApiConfirmation;

it('renders complete dates, guests and exact server amounts without equating a deposit with the total paid', () => {
  const list = document.createElement('dl');
  appendConfirmationStay(list, booking, createBookingI18n('fr'));
  expect(list.querySelector('.cb-confirmation-stay__name')?.textContent).toBe(booking.propertyName);
  expect(list.querySelector('.cb-confirmation-stay__name')?.children).toHaveLength(0);
  expect(list.textContent).toContain('10 juin 2027 · 16:00');
  expect(list.textContent).toContain('13 juin 2027 · 11:00');
  expect(list.textContent).toContain('Voyageurs4');
  expect(list.textContent).toContain('432,50');
  expect(list.textContent).toContain('Acompte payé, solde dû');
  expect(list.textContent).not.toContain('Total payé');
});

it.each(['PAID', 'PARTIALLY_PAID', 'PROCESSING', 'PENDING', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'CANCELLED', 'NOT_REQUIRED', 'UNKNOWN', 'FUTURE_STATUS'])('localizes the independent %s payment state in French, English and Arabic', (paymentStatus) => {
  for (const language of ['fr', 'en', 'ar']) {
    const list = document.createElement('dl');
    appendConfirmationStay(list, { ...booking, paymentStatus }, createBookingI18n(language));
    const payment = list.querySelector('.cb-confirmation-stay__payment')!;
    expect(payment.textContent).not.toContain('confirmation.');
    expect(payment.getAttribute('data-payment-status')).toBe(paymentStatus);
  }
});
