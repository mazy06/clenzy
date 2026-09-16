import { describe, expect, it } from 'vitest';
import { complianceState } from './providerPresentation';

describe('Document expiry dates', () => {
  const today = new Date(2026, 8, 16, 18, 30);
  it('does not mark a document expired during its last valid calendar day', () => {
    expect(complianceState('2026-09-16', today)).toBe('expiring');
    expect(complianceState('2026-09-15', today)).toBe('expired');
  });
  it('uses the same strict thirty-day alert boundary as the server', () => {
    expect(complianceState('2026-10-15', today)).toBe('expiring');
    expect(complianceState('2026-10-16', today)).toBe('valid');
  });
  it('does not interpret a missing date as an expired document', () => {
    expect(complianceState(undefined, today)).toBe('missing');
    expect(complianceState('invalid', today)).toBe('missing');
  });
});
