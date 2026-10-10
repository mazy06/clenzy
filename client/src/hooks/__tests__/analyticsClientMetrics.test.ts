import { expect, it } from 'vitest';
import { computeClientMetrics } from '../analyticsComputeFunctions';
import type { Reservation } from '../../services/api/reservationsApi';

const stay = (id: number, checkIn: string, checkOut: string, status = 'confirmed') => ({
  id, checkIn, checkOut, status, source: 'direct', propertyId: 1, propertyName: 'Studio', guestCount: 2,
}) as Reservation;

it('counts only stays overlapping the selected window, including both boundaries', () => {
  const stays = [
    stay(1, '2026-08-01', '2026-09-09'),
    stay(2, '2026-09-01', '2026-09-10'),
    stay(3, '2026-10-01', '2026-10-05'),
    stay(4, '2026-10-10', '2026-10-14'),
    stay(5, '2026-10-11', '2026-10-15'),
    stay(6, '2026-10-01', '2026-10-05', 'CANCELLED'),
  ];
  const metrics = computeClientMetrics(stays, { from: '2026-09-10', to: '2026-10-10' });
  expect(metrics.totalBookings).toBe(3);
  expect(metrics.bySource).toEqual([expect.objectContaining({ name: 'Direct', value: 3 })]);
  expect(metrics.topProperties[0].bookings).toBe(3);
  expect(metrics.avgStayDuration).toBe(5.7);
  expect(computeClientMetrics(stays).totalBookings).toBe(5);
});

it('returns empty metrics when the selected period contains no stay', () => {
  expect(computeClientMetrics([stay(1, '2026-01-01', '2026-01-05')], { from: '2026-09-10', to: '2026-10-10' }))
    .toMatchObject({ totalBookings: 0, avgStayDuration: 0, avgGuestCount: 0, topProperties: [], bySource: [] });
});
