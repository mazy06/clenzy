/**
 * Constantes partagees par tous les chart widgets de l'assistant.
 *
 * <p>Les couleurs viennent des tokens de graphique Baitly ({@code --bui-chart-1..5},
 * exposes en {@code --color-chart-*}) : elles suivent donc le theme clair/sombre
 * et l'identite Baitly, la ou la palette Clenzy figee en dur qu'elles remplacent
 * (#6B8A9A…) restait claire sur fond sombre. Recharts recevant des chaines CSS,
 * on passe les {@code var(...)} tels quels — le navigateur resout au rendu.</p>
 */

// ─── Palette de graphique Baitly (tokens --chart-1..5) ───────────────────────

export const CHART_PRIMARY = 'var(--color-chart-1)';
export const CHART_SUCCESS = 'var(--color-chart-2)';
export const CHART_WARNING = 'var(--color-chart-3)';
export const CHART_ERROR = 'var(--color-chart-4)';
export const CHART_INFO = 'var(--color-chart-5)';

/** Cycle de couleurs pour series multi (5 couleurs distinctes, accessibles). */
export const CHART_SERIES_COLORS = [
  CHART_PRIMARY,
  CHART_SUCCESS,
  CHART_WARNING,
  CHART_ERROR,
  CHART_INFO,
];

// ─── Styling axes / grille / tooltip / legend ────────────────────────────────

export const AXIS_TICK = { fontSize: 10, fill: 'var(--color-muted-foreground)' } as const;
export const TOOLTIP_CONTENT_STYLE = {
  fontSize: 11,
  borderRadius: 8,
  border: '1px solid var(--color-border)',
  background: 'var(--color-popover)',
  color: 'var(--color-popover-foreground)',
  boxShadow: 'none',
} as const;
export const LEGEND_WRAPPER_STYLE = { fontSize: 10, letterSpacing: '0.02em' } as const;
export const GRID_STROKE = 'var(--color-border)';

// ─── Mapping status → label FR (aligne avec dashboard) ──────────────────────

export const STATUS_LABELS_FR: Record<string, string> = {
  PENDING: 'En attente',
  AWAITING_PAYMENT: 'Paiement en attente',
  IN_PROGRESS: 'En cours',
  COMPLETED: 'Termine',
  CANCELLED: 'Annule',
  SCHEDULED: 'Planifie',
  ON_HOLD: 'En pause',
  CONFIRMED: 'Confirme',
  ACTIVE: 'Actif',
  INACTIVE: 'Inactif',
  UNDER_MAINTENANCE: 'Maintenance',
  ARCHIVED: 'Archive',
};

export function humanizeStatus(name: string): string {
  return STATUS_LABELS_FR[name] || (name.charAt(0) + name.slice(1).toLowerCase().replace(/_/g, ' '));
}

// ─── Standard chart container height ─────────────────────────────────────────

export const CHART_HEIGHT = 220;

// ─── Habillage commun des cartes de widget ───────────────────────────────────

/** Carte de widget : hairline sur fond carte, comme les cartes de la projection. */
export const WIDGET_CARD = 'rounded-xl border border-border bg-card p-3';

/** Sur-titre d'un widget (petites capitales discretes). */
export const WIDGET_OVERLINE = 'text-2xs font-semibold uppercase tracking-wide text-faint';
