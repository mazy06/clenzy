import type { ReceivedForm } from '../../../services/api/receivedFormsApi';
import { parseApiDate } from '../../../utils/formatUtils';
import { activeIntlLocale } from '../../../utils/activeLocale';
// Hors React : la langue se lit a l'appel, pas au chargement du module.
import i18n from '../../../i18n/config';

/**
 * Formatage des formulaires reçus (devis / maintenance / support).
 *
 * Copie locale des mappings de valeur de `modules/contact/ReceivedFormsTab.tsx`
 * (constantes non exportées là-bas — l'écran Contact reste intact, périmètre
 * refonte Messagerie). Source de vérité métier inchangée : payload JSON du
 * formulaire landing.
 */

/**
 * Valeurs connues d'un formulaire recu → cle en locales
 * (`receivedForms.values.<champ>.<valeur>`). La valeur brute reste le repli :
 * un formulaire peut porter une option qu'on ne connait pas.
 */
const DEVIS_VALUE_FIELDS: Record<string, readonly string[]> = {
  propertyType: ['studio', 't1', 't2', 't3', 't4', 'maison', 'villa'],
  bookingFrequency: ['tres-frequent', 'frequent', 'occasionnel', 'rare'],
  cleaningSchedule: ['apres-depart', 'quotidien', 'hebdomadaire'],
  calendarSync: ['sync', 'manual', 'none'],
  urgency: ['low', 'medium', 'high', 'critical'],
};

function devisValueLabel(field: string, value: string): string | undefined {
  if (!DEVIS_VALUE_FIELDS[field]?.includes(value)) return undefined;
  return i18n.t(`receivedForms.values.${field}.${value}`);
}

export function formatFieldValue(key: string, value: unknown): string {
  if (Array.isArray(value)) return value.map((v) => formatFieldValue(key, v)).join(', ');
  const str = String(value);
  // Capacité voyageurs : intervalle (ex. "1-2") → "1 à 2" pour lever l'ambiguïté.
  if (key === 'guestCapacity') {
    const labeled = devisValueLabel(key, str);
    if (labeled) return labeled;
    const range = str.match(/^\s*(\d+)\s*[-–\s]\s*(\d+)\s*$/);
    return range ? i18n.t('receivedForms.range', { from: range[1], to: range[2] }) : str;
  }
  return devisValueLabel(key, str)
    ?? str.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

/** Normalise un champ liste (array OU chaîne "a, b, c") en items individuels. */
export function toList(value: unknown): string[] {
  if (value == null || value === '') return [];
  if (Array.isArray(value)) return value.flatMap((v) => { const s = String(v).trim(); return s ? [s] : []; });
  return String(value).split(',').map((s) => s.trim()).filter(Boolean);
}

export function initialsOf(name: string): string {
  return name
    .split(/[\s.-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('') || '?';
}

export function formatFormDate(d: string): string {
  try {
    // parseApiDate : les timestamps backend sont du LocalDateTime UTC sans
    // fuseau ; sans cette conversion ils s'affichaient avec 2h de retard.
    return parseApiDate(d).toLocaleDateString(activeIntlLocale(), {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return d;
  }
}

/**
 * Pastille de statut, exprimée en VARIANTE du composant Badge plutôt qu'en
 * couples de couleurs : le contraste et le mode sombre sont alors gérés par le
 * kit, là où les paires posées à la main dérivaient à chaque évolution du thème.
 */
export const STATUS_PILL: Record<
  ReceivedForm['status'],
  { labelKey: string; variant: 'warning' | 'info' | 'success' | 'secondary' }
> = {
  NEW: { labelKey: 'receivedForms.status.new', variant: 'warning' },
  READ: { labelKey: 'receivedForms.status.read', variant: 'info' },
  PROCESSED: { labelKey: 'receivedForms.status.processed', variant: 'success' },
  ARCHIVED: { labelKey: 'receivedForms.status.archived', variant: 'secondary' },
};

export const EMAIL_RE = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/;
