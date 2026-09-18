import type { ServiceRequestDetailsData } from '../../hooks/useServiceRequestDetails';

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
