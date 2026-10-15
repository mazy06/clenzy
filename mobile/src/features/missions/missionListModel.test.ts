import { missionListRows } from './missionListModel';
import type { MobileMission } from './api';

it('places active work before review and finished history without mixing groups', () => {
  const missions = ['COMPLETED', 'PENDING', 'AWAITING_VALIDATION', 'IN_PROGRESS', 'CANCELLED']
    .map((status, id) => ({ id, status } as MobileMission));
  const rows = missionListRows(missions);
  expect(rows.filter(row => row.kind === 'heading').map(row => row.group))
    .toEqual(['running', 'upcoming', 'review', 'finished', 'cancelled']);
  expect(rows.filter(row => row.kind === 'mission').map(row => row.mission.id)).toEqual([3, 1, 2, 0, 4]);
  expect(missionListRows([])).toEqual([]);
});
