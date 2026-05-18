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
export const DATE_HEADER_HEIGHT = 46;
export const ACTION_PANEL_WIDTH = 380;

// ─── Row dimensions by density ──────────────────────────────────────────────

export const ROW_CONFIG: Record<DensityMode, {
  rowHeight: number;
  reservationBarHeight: number;
  interventionBarHeight: number;
  interventionTop: number;
  barPadding: number;
}> = {
  // Bar de reservation = 2 lignes (nuits + nom). Hauteur calee pour
  // accommoder 11px label + 13px nom + padding vertical + breathing room.
  normal: {
    rowHeight: 88,
    reservationBarHeight: 48,
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

export const BAR_BORDER_RADIUS = 6;
export const BAR_MIN_WIDTH = 28;
export const INTERVENTION_LANE_GAP = 1;
export const INTERVENTION_BOTTOM_PAD = 2;

// ─── Today line ──────────────────────────────────────────────────────────────

export const TODAY_LINE_COLOR = '#EF4444';
export const TODAY_LINE_WIDTH = 2;

// ─── Weekend / day styling ───────────────────────────────────────────────────

export const WEEKEND_BG_ALPHA = 0.04;

// ─── Pagination ─────────────────────────────────────────────────────────────

export const PAGINATION_BAR_HEIGHT = 32;
export const TOOLBAR_HEIGHT = 40;
export const APP_HEADER_HEIGHT = 56;

// ─── Infinite scroll ────────────────────────────────────────────────────────

export const BUFFER_MULTIPLIER = 3;
export const EXTEND_THRESHOLD_DAYS = 7;
export const DATA_CHUNK_SIZE_DAYS = 30;
