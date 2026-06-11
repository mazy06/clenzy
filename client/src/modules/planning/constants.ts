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
// 52px rangée jour (spec .pl-day : padding 8px 0, .wd 9.5px + .dn 14px /
// carré « aujourd'hui » 24×24 → ~35px de contenu + 2×8px). Pas de rangée
// mois dans la grille : le mois/année vit dans la toolbar (‹ Mois Année ›).
export const DATE_HEADER_HEIGHT = 52;
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

// ─── Positionnement à l'heure (spec JS placeBar) ────────────────────────────
//
// Les briques de réservation sont posées à l'heure de check-in/check-out :
//   left  = (startDayIndex + checkInHour/24)  × dayWidth
//   right = (startDayIndex + nuits + checkOutHour/24) × dayWidth
// Heures par défaut quand la réservation n'en porte pas (champs
// startTime/endTime absents) : 15 h / 11 h — mêmes valeurs que les replis
// defaultCheckInTime/defaultCheckOutTime du drag-to-select.
export const DEFAULT_CHECK_IN_HOUR = 15;
export const DEFAULT_CHECK_OUT_HOUR = 11;
// Spec : width = max(3.5 %, right − left) sur la grille 14 jours de la
// maquette → 3.5 % × 14 jours = 0.49 jour. Exprimé en fraction de jour car
// la grille Clenzy a un nombre de jours variable (timeline infinie).
export const BAR_MIN_DAY_FRACTION = 0.49;

// ─── Couleurs de statut (constantes locales, maquette pl-grid) ──────────────
//
// La COULEUR de brique encode le STATUT de la réservation (le canal est porté
// par la pastille logo). Valeurs EXACTES de planning-grid-reference.css
// (--st-*) ; identiques en sombre — la référence ne les redéfinit pas.
// Annulée = brique fantôme hachurée sans remplissage ; var(--faint) ne sert
// qu'à la puce de la chip Statuts.
// NB : nom historique « DEPARTURE_VIOLET » conservé (consommé par le panneau
// et le popover) — valeur réalignée sur le mauve --st-checkout.
export const PLANNING_DEPARTURE_VIOLET = '#9A7FA3';

export const RESERVATION_STATUS_TOKEN_COLORS: Record<string, string> = {
  confirmed: '#3E9C80',   // --st-confirmee (vert)
  pending: '#C28A52',     // --st-pending   (ambre)
  checked_in: '#4F86C6',  // --st-checkin   (bleu)
  checked_out: PLANNING_DEPARTURE_VIOLET, // --st-checkout (mauve)
  cancelled: 'var(--faint)',
};

// Indicateurs internes (spec --menage / --maintenance) : couleurs des icônes
// ménage (balai) et maintenance (clé à molette). Blocage : neutre.
export const INTERVENTION_TYPE_TOKEN_COLORS: Record<string, string> = {
  cleaning: '#2F9E8D',    // --menage
  maintenance: '#4F86C6', // --maintenance
  blocked: 'var(--muted)',
};

// ─── Today line ──────────────────────────────────────────────────────────────

// Spec .pl-now : rouge #E5484D en CONSTANTE LOCALE (pas de token — couleur
// dédiée maquette, distincte de var(--err)).
export const TODAY_LINE_COLOR = '#E5484D';
export const TODAY_LINE_WIDTH = 2;

// ─── Weekend / day styling ───────────────────────────────────────────────────

// Spec .pl-day.we / .pl-cell.we (--day-we / --cell-we) : constantes locales du
// module. Les valeurs exactes clair/sombre (#F2F6F7·#F8FAFB / #121A21·#131C23)
// sont posées en custom properties dans planningUrgency.css ([data-theme]).
export const WEEKEND_HEADER_BG = 'var(--pl-day-we)';
export const WEEKEND_CELL_BG = 'var(--pl-cell-we)';

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
