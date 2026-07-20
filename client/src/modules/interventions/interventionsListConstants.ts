// Constantes et helpers partagés par InterventionsList et ses vues (carte / grille / liste).

import type { Intervention } from './useInterventionsList';

export const PAGINATION_SX = {
  position: 'sticky',
  bottom: 0,
  bgcolor: 'var(--card)',
  borderTop: '1px solid',
  borderColor: 'var(--line)',
  mt: 2,
  borderRadius: '9px',
} as const;

export const LIST_PAPER_SX = {
  border: '1px solid',
  borderColor: 'var(--line)',
  boxShadow: 'none',
  borderRadius: '14px',
} as const;


/**
 * Retire le suffixe " — {propertyName}" ou " - {propertyName}" du titre.
 * Evite la redondance quand le nom de propriete est deja affiche dans sa
 * propre colonne.
 */
export function stripPropertySuffix(title: string, propertyName?: string): string {
  if (!propertyName) return title;
  const patterns = [` — ${propertyName}`, ` - ${propertyName}`, ` -- ${propertyName}`];
  for (const p of patterns) {
    if (title.endsWith(p)) return title.slice(0, -p.length).trim();
  }
  return title;
}

export function formatDateShort(dateStr: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** COMPLETED interventions always show 100% regardless of stored value */
export const getProgress = (i: Intervention): number =>
  i.status === 'COMPLETED' ? 100 : (i.progressPercentage ?? 0);
