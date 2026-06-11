import type { ZoomLevel, ZoomConfig, DensityMode } from './types';

// ─── Layout dimensions ──────────────────────────────────────────────────────

// Le carousel occupe rowHeight (72px en normal, 50px en compact). Les
// largeurs ci-dessous laissent une marge confortable pour le bloc texte
// (nom 2 lignes + sous-titre + tag count) meme avec des noms longs.
/** Default (large screens ≥1200px) */
export const PROPERTY_COL_WIDTH = 280;
/** Medium screens (≥900px) */
export const PROPERTY_COL_WIDTH_MD = 240;
/** Small screens (<900px) */
export const PROPERTY_COL_WIDTH_SM = 200;
// 20px rangée mois + 36px rangée jour (jour abrégé + numéro en pastille).
export const DATE_HEADER_HEIGHT = 56;
export const ACTION_PANEL_WIDTH = 380;

// ─── Row dimensions by density ──────────────────────────────────────────────

export const ROW_CONFIG: Record<DensityMode, {
  rowHeight: number;
  reservationBarHeight: number;
  interventionBarHeight: number;
  interventionTop: number;
  barPadding: number;
}> = {
  // Bar de reservation = 2 lignes (nuits + nom). Hauteur 44px = spec
  // exacte .s-brick de la maquette Signature (signature.css).
  normal: {
    rowHeight: 88,
    reservationBarHeight: 44,
    interventionBarHeight: 24,
    interventionTop: 56,
    barPadding: 4,
  },
  compact: {
    rowHeight: 64,
    reservationBarHeight: 36,
    interventionBarHeight: 16,
    interventionTop: 42,
    barPadding: 3,
  },
};

// ─── Price line dimensions by density ───────────────────────────────────────
//
// Hauteur dédiée à la rangée tarifs. Doit accommoder la fonte des prix +
// ses ascenders/descenders (~1.3x font-size) sans débordement vertical.
// Plus Jakarta Sans à 8px → ~10-11px visuels → 16px band laisse 2-3px de
// chaque côté pour respirer.
export const PRICE_LINE_HEIGHT: Record<DensityMode, number> = {
  normal: 16,
  compact: 13,
};

// ─── Zoom configuration ─────────────────────────────────────────────────────

export const ZOOM_CONFIGS: Record<ZoomLevel, ZoomConfig> = {
  day: {
    dayWidth: 200,
    showHours: true,
    navStep: 3,
    visibleDays: 7,
  },
  week: {
    dayWidth: 80,
    showHours: false,
    navStep: 7,
    visibleDays: 14,
  },
  month: {
    dayWidth: 38,
    showHours: false,
    navStep: 30,
    visibleDays: 31,
  },
};

// ─── Zoom labels (for toolbar) ──────────────────────────────────────────────

export const ZOOM_LABELS: Record<ZoomLevel, string> = {
  day: 'Jour',
  week: 'Semaine',
  month: 'Mois',
};

// ─── Bar styling ─────────────────────────────────────────────────────────────

export const BAR_BORDER_RADIUS = 9;
export const BAR_MIN_WIDTH = 28;
export const INTERVENTION_LANE_GAP = 1;
export const INTERVENTION_BOTTOM_PAD = 2;

// ─── Couleurs Signature (tokens CSS) ────────────────────────────────────────
//
// Design « Baitly Signature » : la COULEUR de brique encode le STATUT de la
// réservation (le canal est porté par la pastille logo). Tout passe par les
// tokens var(--…) de theme/signature/tokens.css — seule exception : le violet
// « Départ » qui n'a pas de token (constante locale issue de la maquette,
// teinte [data-accent="violet"]).
export const PLANNING_DEPARTURE_VIOLET = '#8A4FD0';

export const RESERVATION_STATUS_TOKEN_COLORS: Record<string, string> = {
  confirmed: 'var(--ok)',
  pending: 'var(--warn)',
  checked_in: 'var(--info)',
  checked_out: PLANNING_DEPARTURE_VIOLET,
  cancelled: 'var(--faint)',
};

// Interventions : même mapping que le MiniPlanningWidget du dashboard
// (cohérence cross-écrans) — ménage bleu, maintenance ambre, blocage neutre.
export const INTERVENTION_TYPE_TOKEN_COLORS: Record<string, string> = {
  cleaning: 'var(--info)',
  maintenance: 'var(--warn)',
  blocked: 'var(--muted)',
};

// ─── Today line ──────────────────────────────────────────────────────────────

export const TODAY_LINE_COLOR = 'var(--err)';
export const TODAY_LINE_WIDTH = 2;

// ─── Weekend / day styling ───────────────────────────────────────────────────

export const WEEKEND_BG_ALPHA = 0.04;

// ─── Pagination ─────────────────────────────────────────────────────────────

export const PAGINATION_BAR_HEIGHT = 32;
// Hauteur desktop : rangée contrôles (~44px) + rangées filtres Canaux/Statuts
// (~64px) + gap. Sert au calcul du pageSize (sur-estimer = sûr, jamais de clip).
export const TOOLBAR_HEIGHT = 116;
export const APP_HEADER_HEIGHT = 56;

// ─── Infinite scroll ────────────────────────────────────────────────────────

export const BUFFER_MULTIPLIER = 3;
export const EXTEND_THRESHOLD_DAYS = 7;
export const DATA_CHUNK_SIZE_DAYS = 30;
