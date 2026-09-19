/**
 * Shared formatting utilities — single source of truth.
 *
 * Replaces ~8 duplicated `formatDate` / `formatDuration` / `formatTimeAgo`
 * functions that were copy-pasted across PropertyCard, ServiceRequestCard,
 * InterventionCard, InterventionsList, ServiceRequestDetails, interventionUtils,
 * dashboard widgets, etc.
 */

import i18n from '../i18n/config';
import {
  formatDayMonthShort,
  formatShortDate as formatShortDateIn,
  intlLocale,
} from './localeDate';

// ─── Langue active ──────────────────────────────────────────────────────────
//
// Ces fonctions sont PURES et appelees partout, y compris hors React (mappers,
// constantes de colonnes, hooks de liste). Elles lisent donc la langue sur le
// singleton i18next plutot que de la recevoir en parametre : la passer aurait
// demande de la faire descendre dans une centaine de signatures.
//
// <p><b>Contrepartie a connaitre.</b> Un composant memoise qui n'est abonne a
// rien ne se repeint pas au changement de langue : ses dates restent dans
// l'ancienne jusqu'au prochain rendu. La ou cela compte — une grille memoisee,
// un en-tete fige — prendre `useDateFormat()` (hooks/useDateFormat), qui
// abonne le composant.</p>

/** Langue i18next active, ou le francais avant l'initialisation. */
function activeLanguage(): string {
  return i18n.language || 'fr';
}

/** Libelle d'erreur de parsing, traduit. */
function invalidDateLabel(): string {
  return i18n.t('common.invalidDate', 'Date invalide');
}

// ─── API timestamp parsing ──────────────────────────────────────────────────

/**
 * Parse un horodatage renvoyé par l'API. Les timestamps backend sont des
 * LocalDateTime UTC SANS marqueur de fuseau ("2026-06-13T16:06:00") ; sans 'Z'
 * le navigateur les lirait en heure LOCALE → décalage (UTC+2 l'été). On force
 * donc l'interprétation UTC quand aucune info de fuseau n'est présente.
 * Compatible avec un futur backend qui enverrait déjà 'Z' (no-op dans ce cas).
 */
export function parseApiDate(value: string | number | Date | null | undefined): Date {
  if (value == null) return new Date(NaN);
  if (value instanceof Date) return value;
  if (typeof value === 'number') return new Date(value);
  const s = value.trim();
  const hasZone = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(s);
  // ISO date-heure SANS fuseau → traiter comme UTC.
  if (!hasZone && /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(s)) {
    return new Date(s.replace(' ', 'T') + 'Z');
  }
  return new Date(s);
}

// ─── Date formatting ────────────────────────────────────────────────────────

/**
 * Date courte dans le calendrier de la langue active — « 18/05/2026 », et le
 * calendrier hegirien en arabe. Rend '' sur une entree vide.
 */
export function formatDate(dateString: string | undefined | null): string {
  if (!dateString) return '';
  try {
    return formatShortDateIn(parseApiDate(dateString), activeLanguage());
  } catch {
    return invalidDateLabel();
  }
}

/** Date + heure dans le calendrier de la langue active — « 18/05/2026 14:30 ». */
export function formatDateTime(dateString: string | undefined | null): string {
  if (!dateString) return '';
  try {
    return parseApiDate(dateString).toLocaleDateString(intlLocale(activeLanguage()), {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return invalidDateLabel();
  }
}

/**
 * Jour + mois abrege — « 14 fevr. ». Employe par les bandeaux de PropertyCard
 * et ServiceRequestCard. Suit le calendrier de la langue active.
 */
export function formatShortDate(dateString: string | undefined | null): string {
  if (!dateString) return '';
  try {
    return formatDayMonthShort(parseApiDate(dateString), activeLanguage());
  } catch {
    return '';
  }
}

/**
 * Extract the time part from a datetime string → "14h30" or "9h".
 * Returns '' if the time is midnight (00:00) or the input is falsy.
 */
export function formatTimeFromDate(dateString: string | undefined | null): string {
  if (!dateString) return '';
  try {
    const d = parseApiDate(dateString);
    const h = d.getHours();
    const m = d.getMinutes();
    if (h === 0 && m === 0) return ''; // midnight = no meaningful time
    return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
  } catch {
    return '';
  }
}

// ─── Duration formatting ────────────────────────────────────────────────────

/**
 * Format a duration in hours to a human-readable string.
 *
 * Examples:
 *   0.5  → "30 min"
 *   1    → "1h"
 *   1.5  → "1h30"
 *   2    → "2h"
 *   2.75 → "2h45min"
 */
export function formatDuration(hours: number): string {
  if (hours <= 0) return '0 min';
  if (hours < 1) {
    const minutes = Math.round(hours * 60);
    return `${minutes} min`;
  }
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h${m.toString().padStart(2, '0')}`;
}
