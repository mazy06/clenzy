/**
 * Constantes partagees par tous les chart widgets de l'assistant.
 *
 * <p>Aligne avec {@code modules/dashboard/DashboardCharts.tsx} : meme palette,
 * memes tailles d'axe/legende/tooltip — pour que les graphes rendus par
 * l'assistant aient le meme aspect que ceux de /reports.</p>
 */

// ─── Palette Clenzy (alignee avec primary.main #6B8A9A) ──────────────────────

export const CHART_PRIMARY = '#6B8A9A';
export const CHART_SUCCESS = '#4A9B8E';
export const CHART_WARNING = '#D4A574';
export const CHART_ERROR = '#C97A7A';
export const CHART_INFO = '#7BA3C2';

/** Cycle de couleurs pour series multi (5 couleurs distinctes, accessibles). */
export const CHART_SERIES_COLORS = [
  CHART_PRIMARY,
  CHART_SUCCESS,
  CHART_WARNING,
  CHART_ERROR,
  CHART_INFO,
];

// ─── Styling axes / grille / tooltip / legend ────────────────────────────────

export const AXIS_TICK = { fontSize: 10, fill: '#94A3B8' } as const;
export const TOOLTIP_CONTENT_STYLE = {
  fontSize: 11,
  borderRadius: 6,
  border: '1px solid #E2E8F0',
  boxShadow: 'none',
} as const;
export const LEGEND_WRAPPER_STYLE = { fontSize: 10, letterSpacing: '0.02em' } as const;
export const GRID_STROKE = '#F1F5F9';

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
