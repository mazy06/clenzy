import { parseApiDate } from '../../utils/formatUtils';

/** Les dates sans fuseau de l'API Baitly sont en UTC, comme sur la fiche. */
export function formatInterventionElapsedTime(startTime: string | null | undefined, now: number): string | null {
  const start = parseApiDate(startTime).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(now)) return null;
  const minutes = Math.max(0, Math.floor((now - start) / 60_000));
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours} h ${String(minutes % 60).padStart(2, '0')}` : `${minutes} min`;
}

/** Après clôture, afficher sa date effective plutôt que la fin prévisionnelle. */
export function interventionEndTime(intervention: {
  status: string;
  completedAt?: string | null;
  endTime?: string | null;
}): string | null | undefined {
  return intervention.status === 'COMPLETED' && intervention.completedAt
    ? intervention.completedAt
    : intervention.endTime;
}
