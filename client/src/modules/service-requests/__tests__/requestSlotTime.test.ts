import { describe, expect, it } from 'vitest';
import { formatRequestSlot } from '../requestDetailPresentation';

const time = { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } as const;
describe('heure du créneau PMS', () => {
  it('préserve les heures locales du logement en hiver et en été', () => {
    expect(formatRequestSlot('2026-11-13T10:00:00', 'fr', 'Europe/Paris', time)).toBe('10:00');
    expect(formatRequestSlot('2026-07-13T10:00:00', 'fr', 'Europe/Paris', time)).toBe('10:00');
    expect(formatRequestSlot('2026-11-13T10:00:00', 'fr', 'Europe/Paris', time, 2)).toBe('12:00');
  });
  it('convertit un instant explicite et conserve le passage de minuit local', () => {
    expect(formatRequestSlot('2026-11-13T10:00:00Z', 'fr', 'Europe/Paris', time)).toBe('11:00');
    expect(formatRequestSlot('2026-11-13T23:00:00', 'fr', 'Europe/Paris', { day: 'numeric' }, 2)).toBe('14');
  });
});
