import { missionSteps, stepNeedsPhoto, stepPhotoPhase, inspectionComplete, canSubmitMission } from './domain';
it('requires initial and final evidence, with separate inventory and restock stages', () => {
  const steps = missionSteps({ type: 'CLEANING' }, 'ON_SITE');
  expect(steps[0]).toBe('inspection'); expect(steps.at(-1)).toBe('signature'); expect(steps.at(-2)).toBe('after_photos');
  expect(steps).toContain('inventory'); expect(steps).toContain('restock');
  expect(stepPhotoPhase('inspection')).toBe('before'); expect(stepPhotoPhase('restock')).toBe('after');
  expect(stepNeedsPhoto('inspection')).toBe(true); expect(stepNeedsPhoto('after_photos')).toBe(true);
  expect(stepNeedsPhoto('inventory')).toBe(false);
  expect(canSubmitMission('Terminé', steps.slice(1), steps, 0)).toBe(false);
  expect(canSubmitMission('Terminé', steps, steps, 1)).toBe(false);
});
it('does not require on-site inspection or photos for remote work', () => {
  expect(missionSteps({ type: 'CLEANING' }, 'REMOTE')).toEqual(['delivery', 'review']);
});
it('requires one different room proof per cleaning room, rather than a total photo count', () => {
  const rooms = [{ id: 'bedroom_1' }, { id: 'bathroom_1' }];
  expect(inspectionComplete(rooms, { inspection_bedroom_1: 2 })).toBe(false);
  expect(inspectionComplete(rooms, { inspection_bedroom_1: 1, inspection_bathroom_1: 1 })).toBe(true);
  expect(inspectionComplete([], {})).toBe(false);
  expect(stepNeedsPhoto('inspection', 'MAINTENANCE')).toBe(false);
  expect(stepNeedsPhoto('inspection', 'LAUNDRY')).toBe(false);
});
