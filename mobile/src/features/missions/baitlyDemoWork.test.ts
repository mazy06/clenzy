import { useBaitlyDataMode } from '@/config/baitlyDataMode';
import { useBaitlyDemoProfile } from '@/config/baitlyDemoProfileState';
import { addDemoStepPhoto, demoWorkDetail, demoWorkList, updateDemoWork, reviewDemoWork } from './baitlyDemoWork';

beforeEach(() => { useBaitlyDataMode.getState().setMode('demo'); useBaitlyDemoProfile.getState().select('maintenance'); });
afterEach(() => { useBaitlyDataMode.getState().setMode('real'); useBaitlyDemoProfile.getState().select(null); });
it('lets the concierge review real demo records and removes processed reports', () => {
  useBaitlyDemoProfile.getState().select('concierge');
  expect(demoWorkList().filter(item => item.status === 'AWAITING_VALIDATION')).toHaveLength(2);
  expect(JSON.parse(demoWorkDetail(-2001).mission.afterPhotosUrls!)).not.toHaveLength(0);
  expect(reviewDemoWork(-2001, true, '').status).toBe('AWAITING_PAYMENT');
  expect(() => reviewDemoWork(-2002, false, '')).toThrow();
  expect(reviewDemoWork(-2002, false, 'Revoir le filtre').followUpNotes).toBe('Revoir le filtre');
  expect(demoWorkList().filter(item => item.status === 'AWAITING_VALIDATION')).toHaveLength(0);
  useBaitlyDemoProfile.getState().select('owner');
  expect(demoWorkDetail(-2001).mission.status).toBe('AWAITING_VALIDATION');
});
it('shows added demo evidence and permits validating the final photo stage', () => {
  useBaitlyDemoProfile.getState().select('cleaning');
  const mission = demoWorkList().find(item => item.type.includes('CLEANING') && item.status === 'IN_PROGRESS')!;
  if (mission.status === 'PENDING') updateDemoWork(mission.id, 'start');
  const before = demoWorkDetail(mission.id);
  addDemoStepPhoto(mission.id, 'after_photos');
  const after = demoWorkDetail(mission.id);
  expect(after.stepPhotoCounts?.after_photos).toBe((before.stepPhotoCounts?.after_photos ?? 0) + 1);
  expect(JSON.parse(after.mission.afterPhotosUrls!)).toHaveLength(JSON.parse(before.mission.afterPhotosUrls ?? '[]').length + 1);
  updateDemoWork(mission.id, 'report', { notes: '', steps: ['after_photos'], version: after.version });
  expect(JSON.parse(demoWorkDetail(mission.id).mission.completedSteps!)).toContain('after_photos');
});
it('starts, resumes and submits a demo task while keeping list and detail consistent', () => {
  const id = -1003;
  expect(updateDemoWork(id, 'start').status).toBe('IN_PROGRESS');
  expect(demoWorkList().find(item => item.id === id)?.status).toBe('IN_PROGRESS');
  const version = demoWorkDetail(id).version;
  updateDemoWork(id, 'report', { notes: 'Climatisation vérifiée', steps: ['diagnostic', 'work', 'test', 'finalCheck'], version });
  expect(demoWorkDetail(id).mission.notes).toBe('Climatisation vérifiée');
  expect(updateDemoWork(id, 'submit').status).toBe('AWAITING_VALIDATION');
  expect(() => updateDemoWork(id, 'start')).toThrow();
});
it('rejects execution by the owner and rejects demo IDs in real mode', () => {
  useBaitlyDemoProfile.getState().select('owner');
  expect(() => updateDemoWork(-1004, 'start')).toThrow();
  useBaitlyDataMode.getState().setMode('real');
  expect(() => demoWorkDetail(-1004)).toThrow();
});
