import { describe, expect, it, vi } from 'vitest';
import { getBaitlySchedulePayload, saveBaitlyInterventionSchedule } from '../utils/baitlyInterventionSchedule';
import { interventionsApi } from '../../../services/api/interventionsApi';
import type { PlanningIntervention } from '../../../services/api';

vi.mock('../../../services/api/interventionsApi', () => ({ interventionsApi: { update: vi.fn().mockResolvedValue({}) } }));
const intervention = { id: 12, startDate: '2026-10-24', endDate: '2026-10-24', startTime: '11:00', endTime: '14:00', estimatedDurationHours: 3 } as PlanningIntervention;

describe('replanification Baitly', () => {
  it('déplace le début sans modifier la durée enregistrée sur le serveur', async () => {
    await saveBaitlyInterventionSchedule(intervention, { startDate: '2026-10-25' });
    expect(interventionsApi.update).toHaveBeenCalledWith(12, { scheduledDate: '2026-10-25T11:00:00' });
  });
  it('calcule une durée civile même au changement d’heure', () => {
    expect(getBaitlySchedulePayload(intervention, { startDate: '2026-10-25', endDate: '2026-10-26', startTime: '01:00', endTime: '04:00' }))
      .toEqual({ scheduledDate: '2026-10-25T01:00:00', estimatedDurationHours: 27 });
  });
  it('refuse une précision que le contrat serveur ne peut pas enregistrer', () => {
    expect(() => getBaitlySchedulePayload(intervention, { endTime: '14:30' })).toThrow('nombre entier');
  });
  it('refuse une fin antérieure au début', () => {
    expect(() => getBaitlySchedulePayload(intervention, { endTime: '10:00' })).toThrow('nombre entier');
  });
});
