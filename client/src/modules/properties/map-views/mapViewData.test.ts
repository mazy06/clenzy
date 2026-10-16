import { describe, expect, it } from 'vitest';
import { groupMissionsByProperty, worstIssueByProperty } from './mapViewData';
import type { Issue } from '../../../services/api/issuesApi';

const marker = (id: number, propertyId: number, state: string) => ({ id, name: 'M', lat: 1, lng: 1, state, propertyId });

describe('groupMissionsByProperty', () => {
  it('compte les missions de chaque logement et garde l’état le plus urgent', () => {
    const grouped = groupMissionsByProperty([marker(1, 7, 'planned'), marker(2, 7, 'late'), marker(3, 7, 'done'), marker(4, 9, 'today')]);

    expect(grouped.get(7)).toEqual({ count: 3, state: 'late' });
    expect(grouped.get(9)).toEqual({ count: 1, state: 'today' });
  });

  it('laisse sans anneau un logement aux missions seulement planifiées', () => {
    expect(groupMissionsByProperty([marker(1, 7, 'planned')]).get(7)).toEqual({ count: 1, state: undefined });
  });
});

describe('worstIssueByProperty', () => {
  it('garde l’anomalie la plus grave de chaque logement', () => {
    const issue = (propertyId: number, severity: Issue['severity']) => ({ propertyId, severity }) as Issue;
    const worst = worstIssueByProperty([issue(7, 'LOW'), issue(7, 'CRITICAL'), issue(7, 'HIGH'), issue(9, 'MEDIUM')]);

    expect(worst.get(7)).toBe('CRITICAL');
    expect(worst.get(9)).toBe('MEDIUM');
  });
});
