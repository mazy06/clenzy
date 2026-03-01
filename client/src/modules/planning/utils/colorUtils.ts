import {
  RESERVATION_STATUS_COLORS,
  INTERVENTION_TYPE_COLORS,
  INTERVENTION_STATUS_COLORS,
} from '../../../services/api/reservationsApi';
import type { ReservationStatus, PlanningInterventionType, PlanningInterventionStatus } from '../../../services/api';
import type { PlanningEventType } from '../types';

export function getReservationColor(status: ReservationStatus): string {
  return RESERVATION_STATUS_COLORS[status] || '#9e9e9e';
}

export function getInterventionColor(type: PlanningInterventionType): string {
  return INTERVENTION_TYPE_COLORS[type] || '#9e9e9e';
}

export function getInterventionStatusColor(status: PlanningInterventionStatus): string {
  return INTERVENTION_STATUS_COLORS[status] || '#9e9e9e';
}

export function getEventTypeColor(type: PlanningEventType): string {
  switch (type) {
    case 'reservation': return '#6B8A9A';
    case 'cleaning': return INTERVENTION_TYPE_COLORS.cleaning;
    case 'maintenance': return INTERVENTION_TYPE_COLORS.maintenance;
    case 'blocked': return '#616161';
    default: return '#9e9e9e';
  }
}

/**
 * Lighten a hex color by a percentage (for backgrounds).
 */
export function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, ((num >> 16) & 0xff) + Math.round(255 * percent));
  const g = Math.min(255, ((num >> 8) & 0xff) + Math.round(255 * percent));
  const b = Math.min(255, (num & 0xff) + Math.round(255 * percent));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/**
 * Convert hex to rgba.
 */
export function hexToRgba(hex: string, alpha: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
