import type { ReceivedForm } from '../../../services/api/receivedFormsApi';
import { parseApiDate } from '../../../utils/formatUtils';

/**
 * Formatage des formulaires reçus (devis / maintenance / support).
 *
 * Copie locale des mappings de valeur de `modules/contact/ReceivedFormsTab.tsx`
 * (constantes non exportées là-bas — l'écran Contact reste intact, périmètre
 * refonte Messagerie). Source de vérité métier inchangée : payload JSON du
 * formulaire landing.
 */

const DEVIS_VALUE_LABELS: Record<string, Record<string, string>> = {
  propertyType: {
    studio: 'Studio', t1: 'T1', t2: 'T2', t3: 'T3', t4: 'T4+', maison: 'Maison', villa: 'Villa',
  },
  bookingFrequency: {
    'tres-frequent': 'Très fréquent', frequent: 'Fréquent', occasionnel: 'Occasionnel', rare: 'Rare',
  },
  cleaningSchedule: {
    'apres-depart': 'Après chaque départ', quotidien: 'Quotidien', hebdomadaire: 'Hebdomadaire',
  },
  calendarSync: {
    sync: 'Synchronisé', manual: 'Manuel', none: 'Aucun',
  },
  urgency: {
    low: 'Faible', medium: 'Moyenne', high: 'Haute', critical: 'Critique',
  },
};

export function formatFieldValue(key: string, value: unknown): string {
  if (Array.isArray(value)) return value.map((v) => formatFieldValue(key, v)).join(', ');
  const str = String(value);
  // Capacité voyageurs : intervalle (ex. "1-2") → "1 à 2" pour lever l'ambiguïté.
  if (key === 'guestCapacity') {
    const labeled = DEVIS_VALUE_LABELS[key]?.[str];
    if (labeled) return labeled;
    const range = str.match(/^\s*(\d+)\s*[-–\s]\s*(\d+)\s*$/);
    return range ? `${range[1]} à ${range[2]}` : str;
  }
  return DEVIS_VALUE_LABELS[key]?.[str] || str.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
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
    return parseApiDate(d).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return d;
  }
}

/** Pilule de statut (.fr-status) — Traité = ok-soft, Nouveau = warn (référence). */
export const STATUS_PILL: Record<ReceivedForm['status'], { label: string; fg: string; bg: string }> = {
  NEW: { label: 'Nouveau', fg: 'var(--warn)', bg: 'var(--warn-soft)' },
  READ: { label: 'Lu', fg: 'var(--info)', bg: 'var(--info-soft)' },
  PROCESSED: { label: 'Traité', fg: 'var(--ok)', bg: 'var(--ok-soft)' },
  ARCHIVED: { label: 'Archivé', fg: 'var(--muted)', bg: 'var(--field)' },
};

export const EMAIL_RE = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/;
