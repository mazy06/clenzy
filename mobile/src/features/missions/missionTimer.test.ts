import { missionTiming, missionTimeWarning, timerText } from './missionTimingModel';
const mission = { id: 1, title: 'Ménage', type: 'CLEANING', status: 'IN_PROGRESS', startTime: '2026-10-13T08:00:00Z', estimatedDurationHours: 1 };
it('warns during the last ten percent and throughout overtime', () => {
  expect(missionTimeWarning(mission, Date.parse('2026-10-13T08:53:59Z'))).toBe(false);
  expect(missionTimeWarning(mission, Date.parse('2026-10-13T08:54:00Z'))).toBe(true);
  expect(missionTimeWarning(mission, Date.parse('2026-10-13T09:10:00Z'))).toBe(true);
});
it('reconstructs elapsed time from the start timestamp and detects overtime', () => {
  expect(missionTiming(mission, Date.parse('2026-10-13T08:15:00Z'))).toEqual({ elapsed: 900, remaining: 2700 });
  expect(missionTiming(mission, Date.parse('2026-10-13T09:05:00Z'))).toEqual({ elapsed: 3900, remaining: -300 });
  expect(timerText(3900)).toBe('01:05:00');
});
it('freezes finished work and does not invent a start time or a budget', () => {
  expect(missionTiming({ ...mission, status: 'COMPLETED', endTime: '2026-10-13T08:30:00Z' }, Date.now()).elapsed).toBe(1800);
  expect(missionTiming({ ...mission, startTime: undefined }, Date.now()).elapsed).toBeUndefined();
  expect(missionTiming({ ...mission, estimatedDurationHours: undefined }, Date.now()).remaining).toBeUndefined();
});
