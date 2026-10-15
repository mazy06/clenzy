import { addDays, dayAgenda, groupReservations, isOccupied, monthGrid, nights } from './bookingModel';

const stay = (id: number, checkIn: string, checkOut: string, status = 'CONFIRMED') => ({ id, propertyId: 1, checkIn, checkOut, status, createdAt: '', updatedAt: '' });

it('whenAddingDays_thenCrossesMonthsWithoutTimeZoneShift', () => {
  expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
  expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
});
it('whenBuildingOctober2026_thenWeeksStartOnMonday', () => {
  const weeks = monthGrid(2026, 9);
  expect(weeks[0]).toEqual([null, null, null, '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
  expect(weeks.every(week => week.length === 7)).toBe(true);
  expect(weeks.flat().filter(Boolean)).toHaveLength(31);
});
it('whenReadingADay_thenArrivalsDeparturesAndStaysAreSeparated', () => {
  const agenda = dayAgenda('2026-10-14', [stay(1, '2026-10-14', '2026-10-16'), stay(2, '2026-10-12', '2026-10-14'), stay(3, '2026-10-10', '2026-10-20'), stay(4, '2026-10-14', '2026-10-15', 'CANCELLED')],
    [{ id: 9, title: 'Ménage', type: 'CLEANING', status: 'PENDING', priority: 'NORMAL', isUrgent: false, requiresFollowUp: false, scheduledDate: '2026-10-14', createdAt: '', updatedAt: '' }]);
  expect(agenda.arrivals.map(r => r.id)).toEqual([1]);
  expect(agenda.departures.map(r => r.id)).toEqual([2]);
  expect(agenda.stays.map(r => r.id)).toEqual([3]);
  expect(agenda.interventions).toHaveLength(1);
});
it('whenGuestLeavesInTheMorning_thenTheNightIsFree', () => {
  expect(isOccupied('2026-10-14', [stay(2, '2026-10-12', '2026-10-14')])).toBe(false);
  expect(nights(stay(1, '2026-10-12', '2026-10-15'))).toBe(3);
});
it('whenGroupingReservations_thenCurrentUpcomingAndPastAreSplit', () => {
  const groups = groupReservations([stay(1, '2026-10-20', '2026-10-22'), stay(2, '2026-10-13', '2026-10-15'), stay(3, '2026-10-01', '2026-10-03')], '2026-10-14');
  expect([groups.current, groups.upcoming, groups.past].map(list => list.map(r => r.id))).toEqual([[2], [1], [3]]);
});
