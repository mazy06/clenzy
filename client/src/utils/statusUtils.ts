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

const PROPERTY_STATUS_HEX: Record<string, string> = {
  ACTIVE: '#4A9B8E',
  INACTIVE: '#757575',
  MAINTENANCE: '#ED6C02',
  UNDER_MAINTENANCE: '#ED6C02',
  RENTED: '#0288d1',
  SOLD: '#d32f2f',
  ARCHIVED: '#d32f2f',
};

export function getPropertyStatusHex(status: string): string {
  return PROPERTY_STATUS_HEX[status?.toUpperCase()] ?? '#757575';
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

const PROPERTY_TYPE_HEX: Record<string, string> = {
  APARTMENT: '#1976d2',
  APPARTEMENT: '#1976d2',
  HOUSE: '#4A9B8E',
  MAISON: '#4A9B8E',
  VILLA: '#7B61FF',
  STUDIO: '#0288d1',
  LOFT: '#D4A574',
  GUEST_ROOM: '#ED6C02',
  COTTAGE: '#2E7D32',
  CHALET: '#D4A574',
  BOAT: '#0288d1',
  OTHER: '#757575',
};

export function getPropertyTypeHex(type: string): string {
  return PROPERTY_TYPE_HEX[type?.toUpperCase()] ?? '#757575';
}

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

const CLEANING_FREQ_HEX: Record<string, string> = {
  AFTER_EACH_STAY: '#4A9B8E',
  WEEKLY: '#0288d1',
  BIWEEKLY: '#0288d1',
  MONTHLY: '#7B61FF',
  ON_DEMAND: '#ED6C02',
  DAILY: '#1976d2',
};

export function getCleaningFrequencyHex(freq: string): string {
  return CLEANING_FREQ_HEX[freq?.toUpperCase()] ?? '#757575';
}

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

// Hex colors for soft-filled chip style (same design as reservation chips)
const SR_STATUS_HEX: Record<string, string> = {
  pending: '#ED6C02',
  approved: '#0288d1',
  devis_accepted: '#4A9B8E',
  awaiting_payment: '#D4A574',
  in_progress: '#1976d2',
  completed: '#4A9B8E',
  cancelled: '#757575',
  rejected: '#d32f2f',
};

export function getServiceRequestStatusHex(status: string): string {
  return SR_STATUS_HEX[status?.toLowerCase()] ?? '#757575';
}

export function getServiceRequestStatusLabel(status: string, t: TranslationFn): string {
  const statusLower = status?.toLowerCase() ?? '';
  const keyMap: Record<string, string> = {
    pending: 'serviceRequests.statuses.pending',
    approved: 'serviceRequests.statuses.approved',
    devis_accepted: 'serviceRequests.statuses.devisAccepted',
    awaiting_payment: 'serviceRequests.statuses.awaitingPayment',
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

const SR_PRIORITY_HEX: Record<string, string> = {
  low: '#4A9B8E',
  normal: '#0288d1',
  medium: '#0288d1',
  high: '#ED6C02',
  urgent: '#d32f2f',
  critical: '#d32f2f',
};

export function getServiceRequestPriorityHex(priority: string): string {
  return SR_PRIORITY_HEX[priority?.toLowerCase()] ?? '#757575';
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

// Hex colors for soft-filled chip style (same design as reservation chips)
const INT_STATUS_HEX: Record<string, string> = {
  PENDING: '#ED6C02',
  AWAITING_VALIDATION: '#D4A574',
  AWAITING_PAYMENT: '#D4A574',
  SCHEDULED: '#0288d1',
  IN_PROGRESS: '#1976d2',
  ON_HOLD: '#ED6C02',
  COMPLETED: '#4A9B8E',
  CANCELLED: '#d32f2f',
};

export function getInterventionStatusHex(status: string): string {
  return INT_STATUS_HEX[status?.toUpperCase()] ?? '#757575';
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

const INT_PRIORITY_HEX: Record<string, string> = {
  LOW: '#4A9B8E',
  NORMAL: '#0288d1',
  HIGH: '#ED6C02',
  URGENT: '#d32f2f',
  CRITICAL: '#d32f2f',
};

export function getInterventionPriorityHex(priority: string): string {
  return INT_PRIORITY_HEX[priority?.toUpperCase()] ?? '#757575';
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

const INT_TYPE_HEX: Record<string, string> = {
  // Nettoyage
  CLEANING: '#4A9B8E',
  EXPRESS_CLEANING: '#4A9B8E',
  DEEP_CLEANING: '#4A9B8E',
  WINDOW_CLEANING: '#4A9B8E',
  FLOOR_CLEANING: '#4A9B8E',
  KITCHEN_CLEANING: '#4A9B8E',
  BATHROOM_CLEANING: '#4A9B8E',
  EXTERIOR_CLEANING: '#4A9B8E',
  DISINFECTION: '#4A9B8E',
  // Maintenance
  MAINTENANCE: '#ED6C02',
  PREVENTIVE_MAINTENANCE: '#ED6C02',
  // Réparation
  REPAIR: '#1976d2',
  EMERGENCY_REPAIR: '#d32f2f',
  ELECTRICAL_REPAIR: '#1976d2',
  PLUMBING_REPAIR: '#1976d2',
  HVAC_REPAIR: '#1976d2',
  APPLIANCE_REPAIR: '#1976d2',
  // Autres
  GARDENING: '#2E7D32',
  PEST_CONTROL: '#7B61FF',
  RESTORATION: '#D4A574',
  INSPECTION: '#0288d1',
  OTHER: '#757575',
};

export function getInterventionTypeHex(type: string): string {
  return INT_TYPE_HEX[type?.toUpperCase()] ?? '#757575';
}

export function getInterventionTypeLabel(type: string, t: TranslationFn): string {
  const key = INT_TYPE_KEYS[type?.toUpperCase()];
  if (key) {
    const translated = t(key);
    return translated !== key ? translated : type;
  }
  return type;
}

// ═════════════════════════════════════════════════════════════════════════════
// AMENITY — hex colors by category
// ═════════════════════════════════════════════════════════════════════════════

const AMENITY_HEX: Record<string, string> = {
  // Tech & confort
  WIFI: '#1976d2',
  TV: '#1976d2',
  AIR_CONDITIONING: '#1976d2',
  HEATING: '#1976d2',
  // Cuisine
  EQUIPPED_KITCHEN: '#4A9B8E',
  DISHWASHER: '#4A9B8E',
  MICROWAVE: '#4A9B8E',
  OVEN: '#4A9B8E',
  // Électroménager
  WASHING_MACHINE: '#0288d1',
  DRYER: '#0288d1',
  IRON: '#0288d1',
  HAIR_DRYER: '#0288d1',
  // Extérieur
  PARKING: '#ED6C02',
  POOL: '#ED6C02',
  JACUZZI: '#ED6C02',
  GARDEN_TERRACE: '#ED6C02',
  BARBECUE: '#ED6C02',
  // Sécurité & Famille
  SAFE: '#7B61FF',
  BABY_BED: '#7B61FF',
  HIGH_CHAIR: '#7B61FF',
};

export function getAmenityHex(amenity: string): string {
  return AMENITY_HEX[amenity?.toUpperCase()] ?? '#757575';
}
