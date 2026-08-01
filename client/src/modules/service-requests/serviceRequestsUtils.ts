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
  id: string;
  title: string;
  description: string;
  type: string;
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
  id: number;
  title: string;
  description: string;
  type?: string;
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

// Utilisation des enums partages pour les couleurs
export const statusColors = Object.fromEntries(
  REQUEST_STATUS_OPTIONS.map(option => [option.value, option.color])
) as Record<RequestStatus, string>;

export const priorityColors = Object.fromEntries(
  PRIORITY_OPTIONS.map(option => [option.value, option.color])
) as Record<Priority, string>;

/**
 * Les couleurs des enums sont des NOMS de palette MUI ('warning', 'success'…) ;
 * la carte Baitly attend une couleur CSS pour son pastel color-mix. Ce pont
 * rabat les noms sur les jetons semantiques.
 */
const MUI_COLOR_TO_CSS: Record<string, string> = {
  warning: 'var(--warn)',
  success: 'var(--ok)',
  error: 'var(--err)',
  info: 'var(--info)',
  primary: 'var(--accent)',
  secondary: 'var(--muted)',
  default: 'var(--muted)',
};

export const statusCssColors: Record<string, string> = Object.fromEntries(
  Object.entries(statusColors).map(([k, v]) => [k, MUI_COLOR_TO_CSS[v] ?? 'var(--muted)']),
);

export const priorityCssColors: Record<string, string> = Object.fromEntries(
  Object.entries(priorityColors).map(([k, v]) => [k, MUI_COLOR_TO_CSS[v] ?? 'var(--muted)']),
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
