import type { ApiConfirmation } from '../api';
import type { BookingI18n } from '../i18n';

const PAYMENT_KEYS: Record<string, string> = {
  PAID: 'paid', PARTIALLY_PAID: 'deposit', PROCESSING: 'processing', PENDING: 'unpaid',
  UNPAID: 'unpaid', FAILED: 'failed', REFUNDED: 'refunded', PARTIALLY_REFUNDED: 'partiallyRefunded',
  CANCELLED: 'paymentCancelled', NOT_REQUIRED: 'notRequired', UNKNOWN: 'unknown',
};

/** Reservation and payment are separate server facts; the return URL never supplies either status. */
export function appendConfirmationStay(list: HTMLElement, booking: ApiConfirmation, i18n: BookingI18n): HTMLElement {
  const group = document.createElement('div');
  group.className = 'cb-confirmation__stay-group';
  const title = document.createElement('dt');
  title.className = 'cb-confirmation-stay__name';
  title.textContent = booking.propertyName || booking.reservationCode;
  const body = document.createElement('dd');
  body.className = 'cb-confirmation-stay';
  const status = document.createElement('div');
  status.className = 'cb-confirmation-stay__statuses';
  const reservation = document.createElement('span');
  const cancelled = booking.status?.toUpperCase() === 'CANCELLED';
  reservation.textContent = i18n.t(cancelled ? 'confirmation.cancelled' : booking.status?.toUpperCase() === 'CONFIRMED' || booking.paymentStatus?.toUpperCase() === 'PAID' ? 'confirmation.confirmed' : 'confirmation.pending');
  const payment = document.createElement('span');
  payment.className = 'cb-confirmation-stay__payment';
  payment.dataset.paymentStatus = booking.paymentStatus?.toUpperCase() || 'UNKNOWN';
  payment.textContent = `${i18n.t('confirmation.paymentStatus')} : ${i18n.t(`confirmation.payment.${PAYMENT_KEYS[payment.dataset.paymentStatus] || 'unknown'}`)}`;
  status.append(reservation, payment);
  const info = document.createElement('dl');
  info.className = 'cb-confirmation-stay__facts';
  const row = (label: string, value: string) => {
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = value;
    info.append(dt, dd);
  };
  const date = (value: string, time: string | null) => {
    if (!value) return i18n.t('searchBar.select');
    const parsed = new Date(`${value}T00:00:00Z`);
    const formatted = Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat(i18n.lang, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(parsed);
    return `${formatted}${time ? ` · ${time}` : ''}`;
  };
  row(i18n.t('confirmation.reference'), booking.reservationCode);
  if (booking.propertyCity) row(i18n.t('confirmation.location'), booking.propertyCity);
  row(i18n.t('detail.checkIn'), date(booking.checkIn, booking.checkInTime));
  row(i18n.t('detail.checkOut'), date(booking.checkOut, booking.checkOutTime));
  if (booking.nights != null) row(i18n.t('confirmation.duration'), `${booking.nights} ${i18n.t('cart.nights')}`);
  if (booking.guests != null) row(i18n.t('confirmation.travelers'), String(booking.guests));
  if (booking.securityDepositAmount != null && booking.securityDepositAmount > 0) {
    let amount: string;
    try { amount = new Intl.NumberFormat(i18n.lang, { style: 'currency', currency: booking.currency }).format(booking.securityDepositAmount); }
    catch { amount = `${booking.securityDepositAmount} ${booking.currency || ''}`; }
    const statuses = ['PENDING', 'SETUP_PENDING', 'HELD', 'RELEASING', 'RELEASED', 'CAPTURING', 'CAPTURED', 'EXPIRED', 'FAILED'];
    const status = statuses.includes(booking.securityDepositStatus || '') ? booking.securityDepositStatus : 'UNKNOWN';
    row(i18n.t('deposit.label'), `${amount} · ${i18n.t(`deposit.status.${status}`)}`);
  }
  const prices = document.createElement('dl');
  prices.className = 'cb-confirmation-stay__prices';
  const money = (label: string, amount: number | undefined) => {
    if (amount == null || !Number.isFinite(amount)) return;
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    try { dd.textContent = new Intl.NumberFormat(i18n.lang, { style: 'currency', currency: booking.currency, maximumFractionDigits: 2 }).format(amount); }
    catch { dd.textContent = `${amount} ${booking.currency || ''}`; }
    prices.append(dt, dd);
  };
  money(i18n.t('confirmation.stayPrice'), booking.subtotal);
  money(i18n.t('confirmation.cleaningFee'), booking.cleaningFee);
  money(i18n.t('confirmation.touristTax'), booking.touristTax);
  money(i18n.t('confirmation.stayTotal'), booking.total);
  body.append(status, info, prices);
  group.append(title, body);
  list.append(group);
  return body;
}
