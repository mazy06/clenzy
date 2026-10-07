import { describe, expect, it, vi } from 'vitest';
import { formatInterventionElapsedTime, interventionEndTime } from '../interventionTime';

vi.mock('../../../i18n/config', () => ({ default: { language: 'fr', t: (_: string, fallback: string) => fallback } }));

describe('temps effectif de la mission Baitly', () => {
  const now = Date.parse('2026-10-06T04:56:00Z');

  it('lit les dates UTC sans fuseau de l’API sans ajouter deux heures', () => {
    expect(formatInterventionElapsedTime('2026-10-06T04:53:26.927319', now)).toBe('2 min');
  });

  it.each(['2026-10-06T04:53:26Z', '2026-10-06T06:53:26+02:00'])(
    'respecte le fuseau explicite %s', (start) => {
      expect(formatInterventionElapsedTime(start, now)).toBe('2 min');
    },
  );

  it('formate les heures écoulées et borne les débuts futurs à zéro', () => {
    expect(formatInterventionElapsedTime('2026-10-06T03:51:00', now)).toBe('1 h 05');
    expect(formatInterventionElapsedTime('2026-10-06T05:00:00', now)).toBe('0 min');
  });

  it.each([null, undefined, 'date incorrecte'])('masque une date absente ou invalide %s', (start) => {
    expect(formatInterventionElapsedTime(start, now)).toBeNull();
  });

  it('affiche la clôture effective même si la fin planifiée était la veille', () => {
    expect(interventionEndTime({
      status: 'COMPLETED', endTime: '2026-10-05T17:00:00', completedAt: '2026-10-06T04:56:16',
    })).toBe('2026-10-06T04:56:16');
  });

  it('conserve la fin planifiée avant clôture et pour les anciennes missions sans date effective', () => {
    expect(interventionEndTime({ status: 'PENDING', endTime: '2026-10-05T17:00:00' })).toBe('2026-10-05T17:00:00');
    expect(interventionEndTime({ status: 'COMPLETED', endTime: '2026-10-05T17:00:00' })).toBe('2026-10-05T17:00:00');
  });
});
