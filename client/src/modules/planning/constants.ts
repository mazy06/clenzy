import type { ZoomLevel, ZoomConfig, DensityMode } from './types';
import type { ReservationStatus } from '../../services/api';

// ─── Filtres légende (rangées Canaux / Statuts de la toolbar) ────────────────
//
// Clés des chips togglables des rangées 2-3 du toolbar. Tout est sélectionné
// par défaut ; un clic masque les briques du canal / statut correspondant.
// Les sources hors légende (ex: 'other') ne sont jamais masquées.
export const PLANNING_CHANNEL_KEYS = ['airbnb', 'booking', 'direct'] as const;
export type PlanningChannelKey = (typeof PLANNING_CHANNEL_KEYS)[number];

export const PLANNING_STATUS_KEYS: readonly ReservationStatus[] = [
  'confirmed',
  'pending',
  'checked_in',
  'checked_out',
  'cancelled',
];

// ─── Layout dimensions ──────────────────────────────────────────────────────

// Colonne logements : 188px = spec exacte .pl-corner / .pl-name de la maquette
// (pl-grid-specs.css). Nom sur une ligne (ellipsis) + ville dessous. La colonne
// reste redimensionnable par l'utilisateur (drag handle).
/** Default (large screens ≥1200px) */
export const PROPERTY_COL_WIDTH = 188;
/** Medium screens (≥900px) */
export const PROPERTY_COL_WIDTH_MD = 188;
/** Small screens (<900px) */
export const PROPERTY_COL_WIDTH_SM = 188;
// 20px rangée mois + 52px rangée jour (spec .pl-day : padding 8px 0, .wd 9.5px
// + .dn 14px / carré « aujourd'hui » 24×24 → ~35px de contenu + 2×8px).
export const DATE_HEADER_HEIGHT = 72;
export const ACTION_PANEL_WIDTH = 380;

// ─── Row dimensions by density ──────────────────────────────────────────────

export const ROW_CONFIG: Record<DensityMode, {
  rowHeight: number;
  reservationBarHeight: number;
  interventionBarHeight: number;
  interventionTop: number;
  barPadding: number;
}> = {
  // Spec exacte .pl-track / .pl-bar (pl-grid-specs.css) : piste 54px, brique
  // 36px posée à top 9px. La brique est centrée dans la ligne avec un simple
  // offset vertical (barPadding) — plus de couloir dédié sous la brique. Les
  // interventions non absorbées (pastille 20px) partagent la même bande
  // verticale : interventionTop centre la pastille dans la rangée.
  normal: {
    rowHeight: 54,
    reservationBarHeight: 36,
    interventionBarHeight: 24,
    interventionTop: 15,  // pastille 20px centrée : 15 + (24-20)/2 = (54-20)/2
    barPadding: 9,        // spec .pl-bar : top 9px — (54-36)/2
  },
  // Compact : proportionnel à la spec 54/36 (ratio ≈ 0.85).
  compact: {
    rowHeight: 46,
    reservationBarHeight: 32,
    interventionBarHeight: 16,
    interventionTop: 15,  // pastille 20px centrée : 15 + (16-20)/2 = (46-20)/2
    barPadding: 7,        // (46-32)/2 — brique 32px centrée
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

// Spec .pl-now : rouge #E5484D en CONSTANTE LOCALE (pas de token — couleur
// dédiée maquette, distincte de var(--err)).
export const TODAY_LINE_COLOR = '#E5484D';
export const TODAY_LINE_WIDTH = 2;

// ─── Weekend / day styling ───────────────────────────────────────────────────

export const WEEKEND_BG_ALPHA = 0.04;

// Spec .pl-day.we / .pl-cell.we (--day-we / --cell-we) : pas de token dédié
// dans tokens.css → constante locale dérivée, translucide et theme-aware.
export const WEEKEND_TINT_BG = 'color-mix(in srgb, var(--ink) 2.5%, transparent)';

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
