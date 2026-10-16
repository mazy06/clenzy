import { planningDateKey, planningHour, planningDemo } from './planningModel';

test('keeps the selected local calendar day', () => {
  expect(planningDateKey(new Date(2026, 9, 12, 0, 5))).toBe('2026-10-12');
});
test('supports API timestamps, plain times and invalid times', () => {
  expect(planningHour('09:30:00', 'fr')).toBe('09:30');
  expect(planningHour('2026-10-12T09:30:00', 'fr')).toBe('09:30');
  expect(planningHour('invalid', 'fr')).toBe('···');
});
test('demo missions use only negative IDs and follow the selected date', () => {
  const items = planningDemo('2026-10-13');
  expect(items).toHaveLength(4);
  expect(items.every(item => item.id < 0 && item.scheduledDate === '2026-10-13')).toBe(true);
});
