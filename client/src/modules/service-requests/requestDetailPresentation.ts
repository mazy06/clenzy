import type { ServiceRequestDetailsData } from '../../hooks/useServiceRequestDetails';
import { parseApiDate } from '../../utils/formatUtils';

/** Les créneaux PMS sans offset sont déjà exprimés dans l'heure du logement. */
export function formatRequestSlot(value: string, language: string, timezone: string | undefined,
  options: Intl.DateTimeFormatOptions, offsetHours = 0): string {
  const explicitZone = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(value.trim());
  const date = parseApiDate(value);
  date.setTime(date.getTime() + offsetHours * 3_600_000);
  return new Intl.DateTimeFormat(language, { ...options, timeZone: explicitZone ? timezone : 'UTC' }).format(date);
}

/** Retire uniquement les marqueurs techniques d'import, jamais les consignes utilisateur. */
export function readableInstructions(value?: string): string {
  return (value ?? '').replace(/\[(?:ICAL|SOURCE):[^\]]*\]\s*/gi, '').trim();
}

export function requestStage(request: Pick<ServiceRequestDetailsData, 'interventionId' | 'status' | 'assignmentPhase'>): number {
  if (request.interventionId) return 3;
  if (['CANCELLED', 'REJECTED', 'COMPLETED', 'IN_PROGRESS'].includes(request.status)) return -1;
  if (['PROPOSED', 'QUOTED'].includes(request.assignmentPhase ?? '')) return 2;
  return 1;
}
