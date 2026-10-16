import type { Intervention } from '../../../services/api/interventionsApi';
import type { ServiceRequest } from '../../../services/api/serviceRequestsApi';

/**
 * Une prestation d'un logement, qu'elle soit déjà planifiée (intervention) ou encore une
 * demande de service. Les deux écrans les présentent séparément ; la fiche du logement les
 * lit comme une seule suite chronologique.
 */
export interface Prestation {
  kind: 'intervention' | 'request';
  id: number;
  title: string;
  /** Code métier (CLEANING, PLUMBING_REPAIR…) : choisit l'icône de la ligne. */
  type: string;
  date: Date;
  status: string;
  assignee: string | null;
  /** Intervenant assigné en personne (pas une équipe) : relie la prestation à son prestataire. */
  assigneeUserId: number | null;
  /** Photo de l'intervenant ; null : initiales. */
  assigneeAvatarUrl: string | null;
  href: string;
}

/**
 * Fusionne interventions et demandes, dans l'ordre chronologique. Une demande déjà
 * transformée en intervention n'apparaît qu'une fois, sous sa forme d'intervention : c'est
 * elle qui porte la date et l'intervenant réels.
 */
export function mergePrestations(interventions: Intervention[], requests: ServiceRequest[]): Prestation[] {
  const planned = new Set(interventions.map((i) => i.id));
  const fromInterventions = interventions
    .filter((i) => i.scheduledDate)
    .map<Prestation>((i) => ({
      kind: 'intervention',
      id: i.id,
      title: i.title,
      type: i.type,
      date: new Date(i.scheduledDate),
      status: i.status,
      assignee: i.assignedToName || null,
      assigneeUserId: i.assignedToType === 'user' && i.assignedToId ? i.assignedToId : null,
      assigneeAvatarUrl: i.assignedToAvatarUrl ?? null,
      href: `/interventions/${i.id}`,
    }));
  const fromRequests = requests
    .filter((r) => r.desiredDate && (r.interventionId == null || !planned.has(r.interventionId)))
    .map<Prestation>((r) => ({
      kind: 'request',
      id: r.id,
      title: r.title,
      type: r.serviceType,
      date: new Date(r.desiredDate),
      status: r.status,
      assignee: r.assignedToName || null,
      assigneeUserId: r.assignedToType === 'user' && r.assignedToId ? r.assignedToId : null,
      assigneeAvatarUrl: null,
      href: `/service-requests/${r.id}`,
    }));
  return [...fromInterventions, ...fromRequests]
    .filter((p) => !Number.isNaN(p.date.getTime()))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

/** Intervenant à mettre en avant pour un jour : le premier assigné en personne, ou null. */
export function dayAssigneeUserId(prestations: Prestation[], day: Date): number | null {
  return prestations.find((p) => sameDay(p.date, day) && p.assigneeUserId != null)?.assigneeUserId ?? null;
}

/** Prestations du jour courant et des jours suivants : de la prochaine aux plus lointaines. */
export function upcomingPrestations(prestations: Prestation[], now: Date): Prestation[] {
  const today = startOfDay(now).getTime();
  return prestations.filter((p) => p.date.getTime() >= today);
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Premier jour de la semaine contenant `date` (0 = dimanche, 1 = lundi). */
export function startOfWeek(date: Date, weekStartsOn: 0 | 1): Date {
  const day = startOfDay(date);
  const shift = (day.getDay() - weekStartsOn + 7) % 7;
  return addDays(day, -shift);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** `aaaa-mm-jj` en heure locale, le format attendu par l'API des interventions. */
export function isoDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
