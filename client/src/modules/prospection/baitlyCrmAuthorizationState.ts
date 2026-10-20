import type { BaitlyCrmAuthorization } from '../../services/api/prospectsApi';
export function baitlyCrmAuthorizationState(history: BaitlyCrmAuthorization[], channel: string, purpose: string, now = Date.now()) {
  const latest = history.find((entry) => entry.channel === channel && entry.purpose === purpose);
  if (!latest) return 'UNKNOWN';
  if (latest.decision === 'REVOKED') return 'REVOKED';
  if (!latest.currentIdentity || (latest.expiresAt && Date.parse(latest.expiresAt) <= now)) return 'UNKNOWN';
  return latest.basis === 'CONSENT' ? 'CONSENT_RECORDED' : 'BASIS_RECORDED';
}
