import { describe, expect, it } from 'vitest';
import type { Intervention } from '../../../services/api/interventionsApi';
import type { ServiceRequest } from '../../../services/api/serviceRequestsApi';
import { dayAssigneeUserId, mergePrestations, startOfWeek, upcomingPrestations } from './prestationTimeline';

const intervention = (id: number, scheduledDate: string): Intervention =>
  ({ id, title: `Intervention ${id}`, status: 'SCHEDULED', scheduledDate, assignedToName: 'Lina' }) as Intervention;
const request = (id: number, desiredDate: string, interventionId?: number): ServiceRequest =>
  ({ id, title: `Demande ${id}`, status: 'PENDING', desiredDate, interventionId }) as ServiceRequest;

describe('mergePrestations', () => {
  it('whenARequestWasPlanned_thenItAppearsOnceAsItsIntervention', () => {
    const merged = mergePrestations([intervention(7, '2026-10-16T10:00:00')], [request(3, '2026-10-16T09:00:00', 7)]);

    expect(merged.map((p) => `${p.kind}:${p.id}`)).toEqual(['intervention:7']);
  });

  it('whenBothKindsAreMixed_thenTheyAreSortedChronologically', () => {
    const merged = mergePrestations(
      [intervention(1, '2026-10-18T10:00:00')],
      [request(2, '2026-10-17T08:00:00'), request(3, '2026-10-19T08:00:00')],
    );

    expect(merged.map((p) => p.id)).toEqual([2, 1, 3]);
    expect(merged[0].href).toBe('/service-requests/2');
  });
});

describe('upcomingPrestations', () => {
  it('whenSomePrestationsArePast_thenOnlyTodayAndLaterRemain', () => {
    const merged = mergePrestations([intervention(1, '2026-10-14T10:00:00'), intervention(2, '2026-10-15T07:00:00')], []);

    expect(upcomingPrestations(merged, new Date('2026-10-15T18:00:00')).map((p) => p.id)).toEqual([2]);
  });
});

describe('startOfWeek', () => {
  it('whenTheWeekStartsOnMonday_thenAThursdayGoesBackToMonday', () => {
    expect(startOfWeek(new Date('2026-10-15T12:00:00'), 1).getDate()).toBe(12);
  });
});

describe('dayAssigneeUserId', () => {
  it('whenADayHasAPersonAssigned_thenItIsTheOneToFocus', () => {
    const team = { ...intervention(1, '2026-10-16T08:00:00'), assignedToType: 'team', assignedToId: 4 } as Intervention;
    const person = { ...intervention(2, '2026-10-16T10:00:00'), assignedToType: 'user', assignedToId: 42 } as Intervention;
    const merged = mergePrestations([team, person], []);

    expect(dayAssigneeUserId(merged, new Date(2026, 9, 16))).toBe(42);
    expect(dayAssigneeUserId(merged, new Date(2026, 9, 17))).toBeNull();
  });
});
