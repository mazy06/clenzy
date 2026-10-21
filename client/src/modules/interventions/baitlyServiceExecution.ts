/** Les contrôles métier utilisent les étapes persistées existantes, jamais les indices de pièces. */
export interface ServiceExecutionProfile {
  kind: 'breakfast' | 'transfer' | 'service';
  checks: readonly string[];
  reportRequired: boolean;
}
const breakfast: ServiceExecutionProfile = { kind: 'breakfast', checks: ['order', 'packaging', 'delivery'], reportRequired: false };
const transfer: ServiceExecutionProfile = { kind: 'transfer', checks: ['boarding', 'destination', 'dropoff'], reportRequired: true };
const service: ServiceExecutionProfile = { kind: 'service', checks: ['work', 'result', 'handover'], reportRequired: false };
export function serviceExecutionProfile(value?: { serviceItemCode?: string; type?: string } | null): ServiceExecutionProfile | null {
  const code = value?.serviceItemCode;
  if (!code && !value?.type) return null;
  if (code === 'culinary-breakfast') return breakfast;
  if (code === 'driver-airport' || code === 'driver-station') return transfer;
  if (code?.startsWith('cleaning-') || value?.type?.toUpperCase().includes('CLEANING')) return null;
  return value ? service : null;
}
export const serviceCheckKey = (profile: ServiceExecutionProfile, check: string) => `service:${profile.kind}:${check}`;
export function serviceValidatedChecks(profile: ServiceExecutionProfile, steps: Set<string>): Set<number> {
  return new Set(profile.checks.flatMap((check, index) => steps.has(serviceCheckKey(profile, check)) ? [index] : []));
}
export function savedExecutionReport(notes?: string): string {
  try { const value = JSON.parse(notes || '{}').after_photos; return typeof value === 'string' ? value.trim() : ''; }
  catch { return ''; }
}
export function serviceProofComplete(profile: ServiceExecutionProfile, steps: Set<string>, photoCount: number, notes?: string): boolean {
  return steps.has('after_photos') && photoCount > 0 && (!profile.reportRequired || !!savedExecutionReport(notes));
}
