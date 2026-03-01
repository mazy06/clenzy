import type { Reservation, PlanningIntervention, ReservationStatus, PlanningInterventionType } from '../../services/api';

// ─── Zoom ────────────────────────────────────────────────────────────────────

export type ZoomLevel = 'day' | 'week' | 'month';

export interface ZoomConfig {
  dayWidth: number;
  showHours: boolean;
  navStep: number;
  visibleDays: number;
}

// ─── Density ─────────────────────────────────────────────────────────────────

export type DensityMode = 'normal' | 'compact';

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

export type PanelTab = 'info' | 'operations' | 'financial' | 'history';

export interface PlanningSelection {
  selectedEventId: string | null;
  panelOpen: boolean;
  panelTab: PanelTab;
}

// ─── Quick create ────────────────────────────────────────────────────────────

export interface QuickCreateData {
  propertyId: number;
  propertyName: string;
  startDate: string;
  endDate: string;
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
}

// ─── Month separator (for date headers) ──────────────────────────────────────

export interface MonthSeparator {
  month: number;
  year: number;
  label: string;
  startIndex: number;
  count: number;
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
