import { civilDateKey, durationLabel, upcomingDays } from './requestScheduleModel';
import { isCivilDate } from './domain';

const units = { hour: 'h', minute: 'min', day: 'Journée' };

it('whenListingUpcomingDays_thenKeysAreValidLocalCivilDatesStartingToday', () => {
  const days = upcomingDays(new Date(2026, 9, 30, 23, 30), 4);
  expect(days.map(day => day.key)).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
  expect(days.every(day => isCivilDate(day.key))).toBe(true);
});
it('whenFormattingADate_thenMonthAndDayArePadded', () => {
  expect(civilDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
});
it('whenLabellingDurations_thenHoursReadNaturally', () => {
  expect(durationLabel(30, units)).toBe('30 min');
  expect(durationLabel(60, units)).toBe('1 h');
  expect(durationLabel(90, units)).toBe('1 h 30');
  expect(durationLabel(480, units)).toBe('Journée');
});
