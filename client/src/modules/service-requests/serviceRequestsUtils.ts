import React from 'react';
import {
  AutoAwesome,
  Build,
  Category,
} from '../../icons';
import { RequestStatus, REQUEST_STATUS_OPTIONS, Priority, PRIORITY_OPTIONS } from '../../types/statusEnums';

// ============================================================================
// INTERFACES
// ============================================================================

export interface ServiceRequest {
  assignmentPhase?: string | null;
  assignmentExpiresAt?: string | null;
  autoAssignStatus?: string | null;
  id: string;
  interventionId?: number;
  version?: number;
  title: string;
  description: string;
  type: string;
  serviceItemCode?: string;
  status: string;
  priority: string;
  propertyId: number;
  propertyName: string;
  propertyAddress: string;
  propertyCity: string;
  requestorId: number;
  requestorName: string;
  assignedToId?: number;
  assignedToName?: string;
  assignedToType?: 'user' | 'team';
  estimatedDuration: number;
  estimatedCost?: number;
  dueDate: string;
  createdAt: string;
  propertyLatitude?: number;
  propertyLongitude?: number;
}

/** Une demande clôturée ne devient jamais en retard. */
export function isServiceRequestOverdue(request: Pick<ServiceRequest, "status" | "dueDate">, now = Date.now()): boolean {
  return !["COMPLETED", "CANCELLED", "REJECTED"].includes(request.status.toUpperCase())
    && !!request.dueDate && new Date(request.dueDate).getTime() < now;
}

/** Retards en premier, du plus ancien au plus récent ; ordre conservé pour le reste. */
export function overdueServiceRequestsFirst<T extends Pick<ServiceRequest, "status" | "dueDate">>(requests: readonly T[], now = Date.now()): T[] {
  return [...requests].sort((a, b) => {
    const aLate = isServiceRequestOverdue(a, now);
    const bLate = isServiceRequestOverdue(b, now);
    return Number(bLate) - Number(aLate)
      || (aLate && bLate ? new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime() : 0);
  });
}

export interface AssignTeam {
  id: number;
  name: string;
}

export interface AssignUser {
  id: number;
  firstName: string;
  lastName: string;
  role: string;
}

export interface ServiceRequestApiResponse {
  assignmentPhase?: string | null;
  assignmentExpiresAt?: string | null;
  autoAssignStatus?: string | null;
  id: number;
  interventionId?: number;
  version?: number;
  title: string;
  description: string;
  type?: string;
  serviceItemCode?: string;
  serviceType?: string;
  status?: string;
  priority?: string;
  propertyId: number;
  property?: { name?: string; address?: string; city?: string; latitude?: number; longitude?: number };
  userId?: number;
  requestorId?: number;
  user?: { firstName: string; lastName: string };
  requestor?: { firstName: string; lastName: string };
  assignedToId?: number;
  assignedTo?: { firstName: string; lastName: string };
  assignedToUser?: { firstName: string; lastName: string };
  assignedToTeam?: { name: string };
  assignedToType?: string;
  estimatedDurationHours?: number;
  estimatedDuration?: number;
  estimatedCost?: number;
  desiredDate?: string;
  dueDate?: string;
  createdAt: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

// Utilisation des enums partages pour les tons semantiques
export const statusColors = Object.fromEntries(
  REQUEST_STATUS_OPTIONS.map(option => [option.value, option.color])
) as Record<RequestStatus, string>;

export const priorityColors = Object.fromEntries(
  PRIORITY_OPTIONS.map(option => [option.value, option.color])
) as Record<Priority, string>;

/**
 * Les couleurs des enums sont des NOMS de palette ('warning', 'success'…) ;
 * la carte Baitly attend une couleur CSS pour son pastel color-mix. Ce pont
 * rabat les noms sur les jetons semantiques Baitly UI.
 *
 * <p>La couleur retenue est la variante `-ink` : elle sert d'ENCRE sur le fond
 * pastel color-mix de la puce, ou la teinte vive plafonne a ~2,2:1.</p>
 */
const TONE_NAME_TO_CSS: Record<string, string> = {
  warning: 'var(--bui-warning-ink)',
  success: 'var(--bui-success-ink)',
  error: 'var(--bui-destructive-ink)',
  info: 'var(--bui-info-ink)',
  primary: 'var(--bui-primary)',
  secondary: 'var(--bui-muted-foreground)',
  default: 'var(--bui-muted-foreground)',
};

export const statusCssColors: Record<string, string> = Object.fromEntries(
  Object.entries(statusColors).map(([k, v]) => [k, TONE_NAME_TO_CSS[v] ?? 'var(--bui-muted-foreground)']),
);

export const priorityCssColors: Record<string, string> = Object.fromEntries(
  Object.entries(priorityColors).map(([k, v]) => [k, TONE_NAME_TO_CSS[v] ?? 'var(--bui-muted-foreground)']),
);

/**
 * Famille d'un type de demande — la rangee de chips de la projection raisonne
 * en trois familles (menage / maintenance / autre), pas en vingt types.
 */
export type ServiceRequestFamily = 'cleaning' | 'maintenance' | 'other';

export function familyOf(type: string): ServiceRequestFamily {
  // Le type circule en minuscules dans la liste (cf. le .toUpperCase() des
  // handlers du hook) : la comparaison se fait casse rabattue.
  const T = type.toUpperCase();
  if (/CLEANING|DISINFECTION/.test(T)) return 'cleaning';
  if (/REPAIR|MAINTENANCE|GARDENING|PEST_CONTROL|RESTORATION/.test(T)) return 'maintenance';
  return 'other';
}

export const typeIcons: Record<string, React.ReactElement> = {
  CLEANING: React.createElement(AutoAwesome),
  EXPRESS_CLEANING: React.createElement(AutoAwesome),
  DEEP_CLEANING: React.createElement(AutoAwesome),
  WINDOW_CLEANING: React.createElement(AutoAwesome),
  FLOOR_CLEANING: React.createElement(AutoAwesome),
  KITCHEN_CLEANING: React.createElement(AutoAwesome),
  BATHROOM_CLEANING: React.createElement(AutoAwesome),
  PREVENTIVE_MAINTENANCE: React.createElement(Build),
  EMERGENCY_REPAIR: React.createElement(Build),
  ELECTRICAL_REPAIR: React.createElement(Build),
  PLUMBING_REPAIR: React.createElement(Build),
  HVAC_REPAIR: React.createElement(Build),
  APPLIANCE_REPAIR: React.createElement(Build),
  GARDENING: React.createElement(Build),
  EXTERIOR_CLEANING: React.createElement(AutoAwesome),
  PEST_CONTROL: React.createElement(Build),
  DISINFECTION: React.createElement(AutoAwesome),
  RESTORATION: React.createElement(Build),
  OTHER: React.createElement(Category),
};
