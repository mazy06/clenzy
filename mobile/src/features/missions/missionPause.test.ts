import { missionTiming } from './missionTimingModel';
import { safetyApi } from './baitlySafetyApi';
import { demoWorkList } from './baitlyDemoWork';
import { useBaitlyDataMode } from '@/config/baitlyDataMode';
import { useBaitlyDemoProfile } from '@/config/baitlyDemoProfileState';
it('freezes elapsed time while paused and subtracts completed pauses', () => {
  const mission = { id: 1, title: '', type: 'CLEANING', status: 'IN_PROGRESS', startTime: '2026-10-13T09:00:00Z', pausedAt: '2026-10-13T09:10:00Z', pauseSeconds: 60 };
  expect(missionTiming(mission, Date.parse('2026-10-13T09:30:00Z')).elapsed).toBe(540);
  expect(missionTiming({ ...mission, pausedAt: null, pauseSeconds: 1260 }, Date.parse('2026-10-13T09:30:00Z')).elapsed).toBe(540);
});
it('records a demo damage, pauses, and resumes without losing the incident', async () => {
  useBaitlyDataMode.getState().setMode('demo'); useBaitlyDemoProfile.getState().select('cleaning');
  try {
    const id = demoWorkList().find(item => item.status === 'IN_PROGRESS')!.id;
    const before = await safetyApi.detail(id);
    const paused = await safetyApi.change(id, 'damage', { cause: 'breakage', room: 'living_1', furnitureId: -1 });
    expect(paused.pausedAt).toBeTruthy(); expect(paused.incidents.length).toBe(before.incidents.length + 1);
    await safetyApi.attachPhoto(id,paused.reportedIssueId!,'file:///demo-proof.jpg');
    expect(await safetyApi.photos(id,paused.reportedIssueId!)).toEqual(['file:///demo-proof.jpg']);
    expect((await safetyApi.change(id, 'resume')).pausedAt).toBeNull();
    expect((await safetyApi.detail(id)).incidents.length).toBe(paused.incidents.length);
  } finally { useBaitlyDemoProfile.getState().select(null); useBaitlyDataMode.getState().setMode('real'); }
});
