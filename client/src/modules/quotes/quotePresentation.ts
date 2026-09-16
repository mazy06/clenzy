import type { StatusTone } from '../../components/baitly/StatusChip';
import type { QuoteRequestStatus } from '../../services/api/quoteRequestsApi';

/**
 * Libellés d'état, écrits du point de vue de celui qui lit.
 *
 * Un même état ne se dit pas pareil des deux côtés : « En attente de votre
 * devis » pour le prestataire est « En attente de réponse » pour le demandeur.
 * Un libellé unique aurait forcé l'un des deux à traduire mentalement.
 */
export const REQUESTER_STATUS_LABELS: Record<QuoteRequestStatus, string> = {
  SENT: 'En attente de réponse',
  QUOTED: 'Devis reçu — à décider',
  ACCEPTED: 'Accepté',
  DECLINED: 'Refusé par vous',
  TURNED_DOWN: 'Décliné par le prestataire',
  WITHDRAWN: 'Retiré',
  EXPIRED: 'Expiré',
};

export const PROVIDER_STATUS_LABELS: Record<QuoteRequestStatus, string> = {
  SENT: 'À chiffrer',
  QUOTED: 'Devis envoyé — en attente',
  ACCEPTED: 'Accepté',
  DECLINED: 'Refusé par le client',
  TURNED_DOWN: 'Décliné par vous',
  WITHDRAWN: 'Retiré par le client',
  EXPIRED: 'Expiré',
};

export const STATUS_TONES: Record<QuoteRequestStatus, StatusTone> = {
  SENT: 'warn',
  QUOTED: 'info',
  ACCEPTED: 'ok',
  DECLINED: 'neutral',
  TURNED_DOWN: 'neutral',
  WITHDRAWN: 'neutral',
  EXPIRED: 'err',
};

/** Ordre de lecture : ce qui demande une action d'abord. */
export const REQUESTER_FILTERS: { label: string; statuses?: QuoteRequestStatus[] }[] = [
  { label: 'Tout' },
  { label: 'À décider', statuses: ['QUOTED'] },
  { label: 'En attente', statuses: ['SENT'] },
  { label: 'Acceptés', statuses: ['ACCEPTED'] },
];

export const PROVIDER_FILTERS: { label: string; statuses?: QuoteRequestStatus[] }[] = [
  { label: 'Tout' },
  { label: 'À chiffrer', statuses: ['SENT'] },
  { label: 'En attente du client', statuses: ['QUOTED'] },
  { label: 'Acceptés', statuses: ['ACCEPTED'] },
];

export function formatDate(value?: string, locale = 'fr'): string {
  if (!value) return '—';
  const localDate = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value;
  return new Date(localDate).toLocaleDateString(locale, {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

/**
 * Un montant absent n'est pas zéro.
 *
 * Afficher « 0 € » là où le prestataire n'a pas encore chiffré ferait croire à
 * une prestation gratuite.
 */
export function formatAmount(amount?: number, currency?: string, locale = 'fr'): string {
  if (amount == null) return '—';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency ?? 'EUR',
    maximumFractionDigits: 2,
  }).format(amount);
}
