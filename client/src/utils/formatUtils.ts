/**
 * Shared formatting utilities — single source of truth.
 *
 * Replaces ~8 duplicated `formatDate` / `formatDuration` / `formatTimeAgo`
 * functions that were copy-pasted across PropertyCard, ServiceRequestCard,
 * InterventionCard, InterventionsList, ServiceRequestDetails, interventionUtils,
 * dashboard widgets, etc.
 */

type TranslationFn = (key: string, options?: Record<string, unknown>) => string;

// ─── Date formatting ────────────────────────────────────────────────────────

/**
 * Format a date string to a localised short date (dd/MM/yyyy).
 * Returns '' for falsy inputs and 'Date invalide' on parse error.
 */
export function formatDate(dateString: string | undefined | null): string {
  if (!dateString) return '';
  try {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return 'Date invalide';
  }
}

/**
 * Format a date string to a localised date-time (dd/MM/yyyy HH:mm).
 */
export function formatDateTime(dateString: string | undefined | null): string {
  if (!dateString) return '';
  try {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Date invalide';
  }
}

/**
 * Smart relative date — "Aujourd'hui", "Demain", or short format.
 * Used by dashboard widgets (UpcomingInterventions, ServiceRequestsWidget, etc.).
 */
export function formatRelativeDate(
  dateString: string | undefined | null,
  t: TranslationFn,
): string {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return t('dashboard.today');
    }
    if (date.toDateString() === tomorrow.toDateString()) {
      return t('dashboard.tomorrow');
    }
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
    });
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

// ─── Time-ago formatting ────────────────────────────────────────────────────

/**
 * Format a Date to a relative "time ago" string.
 * Supports i18n via optional translation function.
 */
export function formatTimeAgo(date: Date, t?: TranslationFn): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (t) {
    if (diffDays > 0) return t('dashboard.activities.timeAgo.days', { count: diffDays });
    if (diffHours > 0) return t('dashboard.activities.timeAgo.hours', { count: diffHours });
    return t('dashboard.activities.timeAgo.now');
  }

  if (diffDays > 0) return `Il y a ${diffDays} jour${diffDays > 1 ? 's' : ''}`;
  if (diffHours > 0) return `Il y a ${diffHours} heure${diffHours > 1 ? 's' : ''}`;
  return "À l'instant";
}
