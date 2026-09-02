import type { ZoomLevel, ZoomConfig, DensityMode } from './types';
import type { ReservationStatus } from '../../services/api';

// ─── Filtres légende (rangées Canaux / Statuts de la toolbar) ────────────────
//
// Clés des chips togglables des rangées 2-3 du toolbar. Tout est sélectionné
// par défaut ; un clic masque les briques du canal / statut correspondant.
// Les sources hors légende (ex: 'other') ne sont jamais masquées.
// La longue traîne (Agoda → Gathern) y figure sans allonger la barre : la
// légende ne rend que les canaux effectivement présents dans les données
// (`presentChannels`), une organisation qui ne vend pas sur Mabeet ne verra
// jamais ce chip.
export const PLANNING_CHANNEL_KEYS =
  ['airbnb', 'booking', 'vrbo', 'expedia',
   'agoda', 'hotels_com', 'hometogo', 'mabeet', 'rentelly', 'gathern',
   'direct'] as const;
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
/**
 * Largeur du rail quand la colonne est repliee (mobile). Pas zero : c'est le
 * chevron de son en-tete qui la ramene — a zero, plus rien a toucher.
 */
export const COLLAPSED_PROPERTY_COL_WIDTH = 28;
// 44px rangée jour : le contenu fait ~35px (jour abrégé 9.5px + carré
// « aujourd'hui » 24×24, la seule pièce incompressible), le reste n'est que de
// l'air — 8px de respiration suffisent, la spec d'origine en mettait 16 et la
// rangée pesait plus lourd que les jours qu'elle annonce. Pas de rangée mois
// dans la grille : le mois/année vit dans la toolbar (‹ Mois Année ›).
export const DATE_HEADER_HEIGHT = 44;
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

// ─── Zoom configuration ─────────────────────────────────────────────────────

// Semaine = 7 jours, Quinzaine = 14 jours (grille maquette repeat(14,1fr),
// dayWidth 80 inchangé), Mois = mois calendaire (~30-31 jours). dayWidth
// calibré pour que visibleDays tiennent dans le viewport grille (~1120px).
export const ZOOM_CONFIGS: Record<ZoomLevel, ZoomConfig> = {
  week: {
    dayWidth: 160,
    visibleDays: 7,
  },
  fortnight: {
    dayWidth: 80,
    visibleDays: 14,
  },
  month: {
    dayWidth: 38,
    visibleDays: 31,
  },
};

// ─── Zoom labels (for toolbar) ──────────────────────────────────────────────

export const ZOOM_LABELS: Record<ZoomLevel, string> = {
  week: 'Semaine',
  fortnight: 'Quinzaine',
  month: 'Mois',
};

// Abreviations affichees sous ~420 px : les libelles pleins font 138 px de
// texte seul, de quoi faire passer le groupe de navigation a la ligne. Memes
// mots abreges — pas de nouvelle semantique (« 14 j » aurait fait croire a une
// duree parametrable).
export const ZOOM_LABELS_SHORT: Record<ZoomLevel, string> = {
  week: 'Sem.',
  fortnight: 'Quinz.',
  month: 'Mois',
};

// ─── Bar styling ─────────────────────────────────────────────────────────────

export const BAR_BORDER_RADIUS = 9;
export const BAR_MIN_WIDTH = 28;
export const INTERVENTION_LANE_GAP = 1;
export const INTERVENTION_BOTTOM_PAD = 2;

// ─── Repli de la brique (priorité : nom > prix réservation > tarif > logos) ──
// Seuils de largeur (px) pilotant, dans PlanningBar, la pilule prix .pl-price
// et la pilule tarif prestation .pl-badge--fee. Ajustables ici (calibrés sur
// les dayWidth : semaine 160, quinzaine 80, mois 38) :
//   ≥ BAR_PRICE_AMOUNT_MIN : prix = pilule icône + montant
//   ≥ BAR_PRICE_INLINE_MIN : prix = pilule icône seule (montant masqué) ;
//                            sous ce seuil le prix se replie dans le « +N »
//   ≥ BAR_FEE_PILL_MIN     : tarif prestation = pilule icône + montant
//                            (sinon carré-icône d'origine)
export const BAR_PRICE_AMOUNT_MIN = 150;
export const BAR_PRICE_INLINE_MIN = 104;
export const BAR_FEE_PILL_MIN = 184;

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

// ─── Couleurs de statut — palette « Terre cuite » ───────────────────────────
//
// La COULEUR de brique encode le STATUT (le canal est porté par la pastille
// logo). Une seule famille de bruns où la VALEUR encode la présence : plus le
// voyageur est là, plus la brique est dense.
//
// TROIS rôles, non interchangeables (contrat Baitly UI, règle `-ink` / teinte
// vive / `-soft`). Une seule table les servait tous les deux auparavant — fond
// de brique ET couleur de texte des pastilles —, et c'est ainsi que les quatre
// statuts se sont retrouvés sous le seuil de lisibilité : une teinte vive
// plafonne à ~2,2:1 en texte.
//
// Les valeurs vivent dans planningUrgency.css : elles changent avec le thème,
// ce qu'une constante JS ne sait pas faire.
//
// Annulée = brique fantôme hachurée sans remplissage ; var(--faint) ne sert
// qu'à la puce de la chip Statuts.

/** Fond de la brique. */
export const RESERVATION_STATUS_BAR_COLORS: Record<string, string> = {
  confirmed: 'var(--pl-st-confirmed)',
  pending: 'var(--pl-st-pending)',
  checked_in: 'var(--pl-st-checked-in)',
  checked_out: 'var(--pl-st-checked-out)',
  cancelled: 'var(--faint)',
};

/**
 * Encre POSÉE SUR la brique. La brique porte un nom et un nombre de nuits :
 * sur un fond beige, du blanc ne se lit pas. C'est cette table qui rend le
 * beige possible — sans elle, la palette serait bornée aux bruns foncés.
 */
export const RESERVATION_STATUS_BAR_INK: Record<string, string> = {
  confirmed: 'var(--pl-st-confirmed-on)',
  pending: 'var(--pl-st-pending-on)',
  checked_in: 'var(--pl-st-checked-in-on)',
  checked_out: 'var(--pl-st-checked-out-on)',
};

/**
 * Encre du statut sur une CARTE (pastilles, libellés, puces) — pas un fond.
 * Nom historique conservé : une quinzaine d'appels la consomment déjà dans ce
 * rôle, et c'est bien celui-là qu'ils veulent.
 */
export const RESERVATION_STATUS_TOKEN_COLORS: Record<string, string> = {
  confirmed: 'var(--pl-st-confirmed-ink)',
  pending: 'var(--pl-st-pending-ink)',
  checked_in: 'var(--pl-st-checked-in-ink)',
  checked_out: 'var(--pl-st-checked-out-ink)',
  cancelled: 'var(--faint)',
};

/**
 * Teinte « Partie » en HEX et non en token : deux appels la concatènent à un
 * suffixe alpha (`${…}1F`) pour composer un fond doux, ce qu'une `var()` ne
 * permet pas. Doit rester alignée sur `--pl-st-checked-out`.
 */
export const PLANNING_DEPARTURE_TINT = '#A89684';

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

// Hauteur du bandeau bas : `PagePagination` (boutons h-8) + respiration.
export const PAGINATION_BAR_HEIGHT = 44;
// Rangee « Occupation » en pied de grille (py-1.5 + texte 10 px + filet).
// Legerement sur-estimee : une ligne de trop cliperait, une de moins ne coute
// qu'un peu de blanc.
export const OCCUPANCY_ROW_HEIGHT = 30;
// Hauteur desktop : rangée contrôles (~44px) + rangée filtres fusionnée
// canaux+statuts+interventions (~32px) + gaps/padding. Sert au calcul du
// pageSize (sur-estimé = sûr, jamais de clip).
export const TOOLBAR_HEIGHT = 116;
export const APP_HEADER_HEIGHT = 56;

// ─── Infinite scroll ────────────────────────────────────────────────────────

export const BUFFER_MULTIPLIER = 3;
/**
 * Plafond du buffer, en multiples de la fenêtre visible.
 *
 * <p>Le buffer ne faisait que CROÎTRE : chaque approche d'un bord ajoutait une
 * fenêtre de jours, et rien n'en retirait jamais. Défiler d'avant en arrière
 * pendant quelques minutes portait `days` à plusieurs centaines d'entrées —
 * autant de colonnes de largeur, de fonds de week-end, et surtout une
 * invalidation du calcul de position de TOUTES les briques à chaque extension.
 * D'où une fluidité qui se dégradait à mesure qu'on scrollait.</p>
 *
 * <p>5× la fenêtre visible : deux fenêtres de marge de chaque côté du contenu
 * affiché, de quoi défiler sans à-coup, sans que le DOM croisse indéfiniment.
 * Au-delà, étendre un bord rogne l'autre (cf. useInfiniteTimeline).</p>
 */
export const MAX_BUFFER_MULTIPLIER = 5;
export const EXTEND_THRESHOLD_DAYS = 7;
export const DATA_CHUNK_SIZE_DAYS = 30;
