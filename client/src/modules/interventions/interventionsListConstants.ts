// Constantes et helpers partagés par InterventionsList et ses vues (carte / grille / liste).

import type { Intervention } from './useInterventionsList';

export const PAGINATION_SX = {
  position: 'sticky',
  bottom: 0,
  bgcolor: 'background.paper',
  borderTop: '1px solid',
  borderColor: 'divider',
  mt: 2,
  borderRadius: 1,
} as const;

export const LIST_PAPER_SX = {
  border: '1px solid',
  borderColor: 'divider',
  boxShadow: 'none',
  borderRadius: 1.5,
} as const;

export const LIST_ROWS_PER_PAGE_OPTIONS = [10, 25, 50];
export const LIST_DEFAULT_ROWS = 10;

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
