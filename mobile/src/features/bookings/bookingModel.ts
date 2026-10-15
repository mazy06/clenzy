import type { Reservation } from '@/api/endpoints/reservationsApi';
import type { Intervention } from '@/api/endpoints/interventionsApi';

/** Civil dates stay strings ("2026-10-14"): no UTC conversion, so no day shift across time zones. */
export function addDays(key: string, days: number) {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}
export function todayKey(now = new Date()) {
  return [now.getFullYear(), now.getMonth() + 1, now.getDate()].map((part, index) => String(part).padStart(index ? 2 : 4, '0')).join('-');
}
export function nights(reservation: Pick<Reservation, 'checkIn' | 'checkOut'>) {
  return Math.max(0, Math.round((Date.parse(`${reservation.checkOut.slice(0, 10)}T00:00:00Z`) - Date.parse(`${reservation.checkIn.slice(0, 10)}T00:00:00Z`)) / 86400000));
}

/** Weeks of the month, Monday first; `null` pads days of the neighbouring months. */
export function monthGrid(year: number, month: number): (string | null)[][] {
  const first = new Date(Date.UTC(year, month, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells = [...Array(offset).fill(null), ...Array.from({ length: days }, (_, index) => addDays(first.toISOString().slice(0, 10), index))];
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, week) => cells.slice(week * 7, week * 7 + 7));
}

export type InterventionKind = 'cleaning' | 'maintenance' | 'other';
export function interventionKind(type: string): InterventionKind {
  if (/CLEAN/.test(type)) return 'cleaning';
  if (/MAINTENANCE|REPAIR|HVAC|PLUMB|ELECTR|APPLIANCE/.test(type)) return 'maintenance';
  return 'other';
}
export function interventionDay(intervention: Pick<Intervention, 'scheduledDate' | 'startTime'>) {
  return (intervention.scheduledDate ?? intervention.startTime)?.slice(0, 10) ?? null;
}

const active = (reservation: Reservation) => reservation.status !== 'CANCELLED';
/** What happens on one day: who arrives, who leaves, who stays, and the work planned. */
export function dayAgenda(day: string, reservations: Reservation[], interventions: Intervention[]) {
  const live = reservations.filter(active);
  return {
    arrivals: live.filter(r => r.checkIn.slice(0, 10) === day),
    departures: live.filter(r => r.checkOut.slice(0, 10) === day),
    stays: live.filter(r => r.checkIn.slice(0, 10) < day && r.checkOut.slice(0, 10) > day),
    interventions: interventions.filter(i => interventionDay(i) === day),
  };
}
/** True when at least one guest sleeps in a home on the night starting that day. */
export function isOccupied(day: string, reservations: Reservation[]) {
  return reservations.some(r => active(r) && r.checkIn.slice(0, 10) <= day && r.checkOut.slice(0, 10) > day);
}

export function groupReservations(reservations: Reservation[], today: string) {
  const sorted = [...reservations].sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  return {
    current: sorted.filter(r => active(r) && r.checkIn.slice(0, 10) <= today && r.checkOut.slice(0, 10) >= today),
    upcoming: sorted.filter(r => active(r) && r.checkIn.slice(0, 10) > today),
    past: sorted.filter(r => !active(r) || r.checkOut.slice(0, 10) < today).reverse(),
  };
}
