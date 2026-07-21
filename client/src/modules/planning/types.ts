import type { Reservation, PlanningIntervention, PlanningServiceRequest, ReservationStatus, PlanningInterventionType } from '../../services/api';

// ─── Zoom ────────────────────────────────────────────────────────────────────

// Trois vues : semaine (7 jours), quinzaine (14 jours, maquette/défaut),
// mois (mois calendaire ~30-31 jours). La vue « jour » a été supprimée.
export type ZoomLevel = 'week' | 'fortnight' | 'month';

export interface ZoomConfig {
  dayWidth: number;
  /** Nb de jours de la vue — sert aussi de pas de navigation ‹ ›
   *  (sauf 'month' : avance d'un mois calendaire dans usePlanningNavigation). */
  visibleDays: number;
}

// ─── Density ─────────────────────────────────────────────────────────────────

export type DensityMode = 'normal' | 'compact';

// ─── Animation d'urgence (briques paiement en attente / info manquante) ──────

export type UrgencyAnimationMode = 'shake' | 'wobble' | 'pop' | 'tada' | 'none';

// ─── Planning events ─────────────────────────────────────────────────────────

export type PlanningEventType = 'reservation' | 'cleaning' | 'maintenance' | 'blocked';

export interface PlanningEvent {
  id: string;
  type: PlanningEventType;
  propertyId: number;
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  label: string;
  sublabel?: string;
  status: string;
  color: string;
  borderColor?: string;
  reservation?: Reservation;
  intervention?: PlanningIntervention;
  isAwaitingPayment?: boolean;
  needsPaymentBadge?: boolean;
  paymentBadgeStatus?: 'PENDING' | 'PROCESSING' | 'FAILED';
  serviceRequest?: PlanningServiceRequest;
}

// ─── Bar layout (computed pixel positions) ───────────────────────────────────

export type BarLayer = 'primary' | 'secondary';

export interface BarLayout {
  event: PlanningEvent;
  left: number;
  width: number;
  top: number;
  height: number;
  layer: BarLayer;
}

// ─── Filters ─────────────────────────────────────────────────────────────────

export interface PlanningFilters {
  statuses: ReservationStatus[];
  interventionTypes: PlanningInterventionType[];
  propertyIds: number[];
  searchQuery: string;
  showInterventions: boolean;
  showPrices: boolean;
}

// ─── Selection ───────────────────────────────────────────────────────────────

// Tabs when a reservation is selected
export type ReservationPanelTab = 'info' | 'property' | 'operations' | 'financial';
// Tabs when an intervention is selected
export type InterventionPanelTab = 'info' | 'progress' | 'recap' | 'payment';
// Union of all panel tabs
export type PanelTab = ReservationPanelTab | InterventionPanelTab;

export interface PlanningSelection {
  selectedEventId: string | null;
  panelOpen: boolean;
  panelTab: PanelTab;
}

// ─── Panel drill-down navigation ────────────────────────────────────────────

export type PanelView =
  | { type: 'root' }
  | { type: 'property-details'; propertyId: number }
  | { type: 'intervention-detail'; interventionId: number };

// ─── Quick create ────────────────────────────────────────────────────────────

export interface QuickCreateData {
  propertyId: number;
  propertyName: string;
  startDate: string;
  endDate: string;
  nightlyPrice: number;
  defaultCheckInTime?: string;
  defaultCheckOutTime?: string;
  cleaningFrequency?: string;
  cleaningBasePrice?: number;
}

// ─── Planning property (lightweight) ─────────────────────────────────────────

export interface PlanningProperty {
  id: number;
  name: string;
  address: string;
  city: string;
  ownerName?: string;
  maxGuests: number;
  type?: string;
  nightlyPrice?: number;
  minimumNights?: number;
  defaultCheckInTime?: string;
  defaultCheckOutTime?: string;
  cleaningFrequency?: string;
  cleaningBasePrice?: number;
  currency?: string;
  photoUrls?: string[];
  latitude?: number;
  longitude?: number;
}

// ─── Drag & drop ────────────────────────────────────────────────────────────

export type DragType = 'move' | 'resize';

export interface DragBarData {
  type: DragType;
  event: PlanningEvent;
  layout: BarLayout;
}

export interface PlanningDragState {
  activeId: string | null;
  activeType: DragType | null;
  dragConflict: boolean;
  ghostLayout: BarLayout | null;
  isDragging: boolean;
}

/**
 * Sous-ensemble de PlanningDragState limité à UNE ligne : seul un RESIZE en
 * cours sur un event de la ligne la concerne (largeur live de la brique).
 * `null` pour toutes les autres lignes → leur React.memo tient pendant le
 * drag (le ghost du MOVE est rendu dans le DragOverlay global, pas par ligne).
 */
export interface RowDragState {
  /** Id draggable actif (`resize-<eventId>`). */
  activeId: string;
  /** Largeur live du ghost pendant le resize. */
  ghostWidth: number;
  /** Conflit détecté sur la position courante. */
  conflict: boolean;
}
