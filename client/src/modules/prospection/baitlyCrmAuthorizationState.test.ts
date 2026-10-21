import { describe, it, expect } from 'vitest';
import type { BaitlyCrmAuthorization } from '../../services/api/prospectsApi';
import { baitlyCrmAuthorizationState as state } from './baitlyCrmAuthorizationState';
const grant: BaitlyCrmAuthorization = { id: 1, channel: 'EMAIL', purpose: 'MANAGEMENT', basis: 'CONSENT', decision: 'GRANTED',
 evidence: 'Form', occurredAt: '2026-10-01T12:00:00Z', recordedAt: '2026-10-01T12:01:00Z', recordedBy: 'actor', currentIdentity: true };
describe('Baitly CRM contact assertions', () => {
 it('defaults to unknown, including imported contacts', () => expect(state([],'EMAIL','MANAGEMENT')).toBe('UNKNOWN'));
 it('does not reuse permission for another purpose or channel', () => {
   expect(state([grant],'SMS','MANAGEMENT')).toBe('UNKNOWN');
   expect(state([grant],'EMAIL','PROVIDER_RECRUITMENT')).toBe('UNKNOWN');
 });
 it('a withdrawal takes precedence over previous grants', () => {
   expect(state([{ ...grant, id: 2, decision: 'REVOKED' },grant],'EMAIL','MANAGEMENT')).toBe('REVOKED');
 });
 it('a changed identity or expired agreement does not reuse earlier permission', () => {
   expect(state([{ ...grant, currentIdentity: false },grant],'EMAIL','MANAGEMENT')).toBe('UNKNOWN');
   expect(state([{ ...grant, expiresAt: '2026-10-02T00:00:00Z' }],'EMAIL','MANAGEMENT',Date.parse('2026-10-03'))).toBe('UNKNOWN');
 });
 it('distinguishes consent from a declared alternative basis', () => {
   expect(state([grant],'EMAIL','MANAGEMENT')).toBe('CONSENT_RECORDED');
   expect(state([{ ...grant, basis: 'REQUESTED_CONTACT' }],'EMAIL','MANAGEMENT')).toBe('BASIS_RECORDED');
 });
});
