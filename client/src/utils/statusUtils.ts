/**
 * Shared status / priority / type utilities — single source of truth.
 *
 * Replaces ~6 duplicated getStatusColor/getStatusLabel/getPriorityColor/
 * getPriorityLabel/getTypeLabel functions scattered across PropertyCard,
 * ServiceRequestCard, InterventionCard, InterventionsList, ServiceRequestDetails,
 * interventionUtils, dashboard widgets, etc.
 *
 * Each entity domain (property, serviceRequest, intervention) has its own
 * mapping since they use different status values.
 */

import type { ChipColor } from '../types';

type TranslationFn = (key: string, options?: Record<string, unknown>) => string;

// ═════════════════════════════════════════════════════════════════════════════
// PROPERTY — statuses, types, cleaning frequencies
// ═════════════════════════════════════════════════════════════════════════════

const PROPERTY_STATUS_COLORS: Record<string, ChipColor> = {
  ACTIVE: 'success',
  INACTIVE: 'default',
  MAINTENANCE: 'warning',
  UNDER_MAINTENANCE: 'warning',
  RENTED: 'info',
  SOLD: 'error',
  ARCHIVED: 'error',
};

export function getPropertyStatusColor(status: string): ChipColor {
  return PROPERTY_STATUS_COLORS[status.toUpperCase()] ?? 'default';
}

export function getPropertyStatusLabel(status: string, t: TranslationFn): string {
  const key = `properties.statuses.${status.toUpperCase()}`;
  const translated = t(key);
  return translated !== key ? translated : status;
}

const PROPERTY_TYPE_KEYS: Record<string, string> = {
  APARTMENT: 'properties.types.apartment',
  APPARTEMENT: 'properties.types.apartment',
  HOUSE: 'properties.types.house',
  MAISON: 'properties.types.house',
  VILLA: 'properties.types.villa',
  STUDIO: 'properties.types.studio',
  LOFT: 'properties.types.loft',
  GUEST_ROOM: 'properties.types.guestRoom',
  COTTAGE: 'properties.types.cottage',
  CHALET: 'properties.types.chalet',
  BOAT: 'properties.types.boat',
  OTHER: 'properties.types.other',
};

export function getPropertyTypeLabel(type: string, t: TranslationFn): string {
  const key = PROPERTY_TYPE_KEYS[type.toUpperCase()];
  if (key) {
    const translated = t(key);
    return translated !== key ? translated : type;
  }
  return type;
}

const CLEANING_FREQ_KEYS: Record<string, string> = {
  AFTER_EACH_STAY: 'properties.cleaningFrequencies.afterEachStay',
  WEEKLY: 'properties.cleaningFrequencies.weekly',
  BIWEEKLY: 'properties.cleaningFrequencies.biweekly',
  MONTHLY: 'properties.cleaningFrequencies.monthly',
  ON_DEMAND: 'properties.cleaningFrequencies.onDemand',
  DAILY: 'properties.cleaningFrequencies.daily',
};

export function getCleaningFrequencyLabel(freq: string, t: TranslationFn): string {
  const key = CLEANING_FREQ_KEYS[freq.toUpperCase()];
  if (key) {
    const translated = t(key);
    return translated !== key ? translated : freq;
  }
  return freq;
}

// ═════════════════════════════════════════════════════════════════════════════
// SERVICE REQUEST — statuses, priorities
// ═════════════════════════════════════════════════════════════════════════════

const SR_STATUS_COLORS: Record<string, ChipColor> = {
  pending: 'warning',
  approved: 'info',
  devis_accepted: 'success',
  in_progress: 'info',
  completed: 'success',
  cancelled: 'default',
  rejected: 'error',
};

export function getServiceRequestStatusColor(status: string): ChipColor {
  return SR_STATUS_COLORS[status?.toLowerCase()] ?? 'default';
}

export function getServiceRequestStatusLabel(status: string, t: TranslationFn): string {
  const statusLower = status?.toLowerCase() ?? '';
  const keyMap: Record<string, string> = {
    pending: 'serviceRequests.statuses.pending',
    approved: 'serviceRequests.statuses.approved',
    devis_accepted: 'serviceRequests.statuses.devisAccepted',
    in_progress: 'serviceRequests.statuses.inProgress',
    completed: 'serviceRequests.statuses.completed',
    cancelled: 'serviceRequests.statuses.cancelled',
    rejected: 'serviceRequests.statuses.rejected',
  };
  const key = keyMap[statusLower];
  if (key) return t(key);
  return status;
}

const SR_PRIORITY_COLORS: Record<string, ChipColor> = {
  low: 'default',
  normal: 'info',
  medium: 'info',
  high: 'warning',
  urgent: 'error',
  critical: 'error',
};

export function getServiceRequestPriorityColor(priority: string): ChipColor {
  return SR_PRIORITY_COLORS[priority?.toLowerCase()] ?? 'default';
}

export function getServiceRequestPriorityLabel(priority: string, t: TranslationFn): string {
  const pLower = priority?.toLowerCase() ?? '';
  const keyMap: Record<string, string> = {
    low: 'serviceRequests.priorities.low',
    normal: 'serviceRequests.priorities.normal',
    medium: 'serviceRequests.priorities.medium',
    high: 'serviceRequests.priorities.high',
    urgent: 'serviceRequests.priorities.urgent',
    critical: 'serviceRequests.priorities.critical',
  };
  const key = keyMap[pLower];
  if (key) return t(key);
  return priority;
}

// ═════════════════════════════════════════════════════════════════════════════
// INTERVENTION — statuses, priorities, types
// ═════════════════════════════════════════════════════════════════════════════

const INT_STATUS_COLORS: Record<string, ChipColor> = {
  PENDING: 'warning',
  AWAITING_VALIDATION: 'warning',
  AWAITING_PAYMENT: 'warning',
  SCHEDULED: 'info',
  IN_PROGRESS: 'primary',
  ON_HOLD: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'error',
};

export function getInterventionStatusColor(status: string): ChipColor {
  return INT_STATUS_COLORS[status?.toUpperCase()] ?? 'default';
}

export function getInterventionStatusLabel(status: string, t: TranslationFn): string {
  const key = `interventions.statuses.${status?.toUpperCase()}`;
  const translated = t(key);
  return translated !== key ? translated : status;
}

const INT_PRIORITY_COLORS: Record<string, ChipColor> = {
  LOW: 'success',
  NORMAL: 'info',
  HIGH: 'warning',
  URGENT: 'error',
  CRITICAL: 'error',
};

export function getInterventionPriorityColor(priority: string): ChipColor {
  return INT_PRIORITY_COLORS[priority?.toUpperCase()] ?? 'default';
}

export function getInterventionPriorityLabel(priority: string, t: TranslationFn): string {
  const key = `interventions.priorities.${priority?.toUpperCase()}`;
  const translated = t(key);
  return translated !== key ? translated : priority;
}

const INT_TYPE_KEYS: Record<string, string> = {
  CLEANING: 'interventions.types.CLEANING',
  EXPRESS_CLEANING: 'interventions.types.EXPRESS_CLEANING',
  DEEP_CLEANING: 'interventions.types.DEEP_CLEANING',
  WINDOW_CLEANING: 'interventions.types.WINDOW_CLEANING',
  FLOOR_CLEANING: 'interventions.types.FLOOR_CLEANING',
  KITCHEN_CLEANING: 'interventions.types.KITCHEN_CLEANING',
  BATHROOM_CLEANING: 'interventions.types.BATHROOM_CLEANING',
  MAINTENANCE: 'interventions.types.MAINTENANCE',
  PREVENTIVE_MAINTENANCE: 'interventions.types.PREVENTIVE_MAINTENANCE',
  REPAIR: 'interventions.types.REPAIR',
  EMERGENCY_REPAIR: 'interventions.types.EMERGENCY_REPAIR',
  ELECTRICAL_REPAIR: 'interventions.types.ELECTRICAL_REPAIR',
  PLUMBING_REPAIR: 'interventions.types.PLUMBING_REPAIR',
  HVAC_REPAIR: 'interventions.types.HVAC_REPAIR',
  APPLIANCE_REPAIR: 'interventions.types.APPLIANCE_REPAIR',
  GARDENING: 'interventions.types.GARDENING',
  EXTERIOR_CLEANING: 'interventions.types.EXTERIOR_CLEANING',
  PEST_CONTROL: 'interventions.types.PEST_CONTROL',
  DISINFECTION: 'interventions.types.DISINFECTION',
  RESTORATION: 'interventions.types.RESTORATION',
  INSPECTION: 'interventions.types.INSPECTION',
  OTHER: 'interventions.types.OTHER',
};

export function getInterventionTypeLabel(type: string, t: TranslationFn): string {
  const key = INT_TYPE_KEYS[type?.toUpperCase()];
  if (key) {
    const translated = t(key);
    return translated !== key ? translated : type;
  }
  return type;
}
