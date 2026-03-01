import type { ZoomLevel, ZoomConfig, DensityMode } from './types';

// ─── Layout dimensions ──────────────────────────────────────────────────────

/** Default (large screens ≥1200px) */
export const PROPERTY_COL_WIDTH = 180;
/** Medium screens (≥900px) */
export const PROPERTY_COL_WIDTH_MD = 150;
/** Small screens (<900px) */
export const PROPERTY_COL_WIDTH_SM = 120;
export const DATE_HEADER_HEIGHT = 60;
export const ACTION_PANEL_WIDTH = 420;

// ─── Row dimensions by density ──────────────────────────────────────────────

export const ROW_CONFIG: Record<DensityMode, {
  rowHeight: number;
  reservationBarHeight: number;
  interventionBarHeight: number;
  interventionTop: number;
  barPadding: number;
}> = {
  normal: {
    rowHeight: 68,
    reservationBarHeight: 34,
    interventionBarHeight: 24,
    interventionTop: 38,
    barPadding: 4,
  },
  compact: {
    rowHeight: 46,
    reservationBarHeight: 26,
    interventionBarHeight: 16,
    interventionTop: 28,
    barPadding: 2,
  },
};

// ─── Price line dimensions by density ───────────────────────────────────────

export const PRICE_LINE_HEIGHT: Record<DensityMode, number> = {
  normal: 20,
  compact: 16,
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

export const PAGINATION_BAR_HEIGHT = 40;
export const TOOLBAR_HEIGHT = 48;
export const APP_HEADER_HEIGHT = 64;

// ─── Infinite scroll ────────────────────────────────────────────────────────

export const BUFFER_MULTIPLIER = 3;
export const EXTEND_THRESHOLD_DAYS = 7;
export const DATA_CHUNK_SIZE_DAYS = 30;
