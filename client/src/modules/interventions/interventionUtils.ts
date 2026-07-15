// Re-export shared utilities for backward compatibility
export {
  getInterventionStatusLabel as getStatusLabel,
  getInterventionPriorityLabel as getPriorityLabel,
  getInterventionTypeLabel as getTypeLabel,
  getInterventionTypeHex as getTypeHex,
} from '../../utils/statusUtils';
export type { ChipColor } from '../../types';
export { formatDateTime as formatDate, formatDuration } from '../../utils/formatUtils';

// ─── Tokens Signature (reskin Baitly) ────────────────────────────────────────
// Chips -soft : texte couleur sémantique + fond `-soft` (baseline §2 chips).
// Tons sémantiques mutualisés via la primitive partagée StatusChip — alias
// rétro-compatibles conservés (SoftTokens, *_TOKENS) pour les consommateurs.

import { STATUS_TONES, type ToneTokens } from '../../components/StatusChip';

export type SoftTokens = ToneTokens;

export const OK_TOKENS: SoftTokens = STATUS_TONES.ok;
export const WARN_TOKENS: SoftTokens = STATUS_TONES.warn;
export const ERR_TOKENS: SoftTokens = STATUS_TONES.err;
export const INFO_TOKENS: SoftTokens = STATUS_TONES.info;
export const NEUTRAL_TOKENS: SoftTokens = STATUS_TONES.neutral;

const STATUS_TOKENS: Record<string, SoftTokens> = {
  PENDING: WARN_TOKENS,
  AWAITING_VALIDATION: WARN_TOKENS,
  AWAITING_PAYMENT: WARN_TOKENS,
  SCHEDULED: INFO_TOKENS,
  IN_PROGRESS: INFO_TOKENS,
  ON_HOLD: WARN_TOKENS,
  COMPLETED: OK_TOKENS,
  CANCELLED: ERR_TOKENS,
};

export function getStatusTokens(status: string): SoftTokens {
  return STATUS_TOKENS[status?.toUpperCase()] ?? NEUTRAL_TOKENS;
}

const PRIORITY_TOKENS: Record<string, SoftTokens> = {
  LOW: OK_TOKENS,
  NORMAL: INFO_TOKENS,
  HIGH: WARN_TOKENS,
  URGENT: ERR_TOKENS,
  CRITICAL: ERR_TOKENS,
};

export function getPriorityTokens(priority: string): SoftTokens {
  return PRIORITY_TOKENS[priority?.toUpperCase()] ?? NEUTRAL_TOKENS;
}

// Couleurs data validées planning (constants.ts INTERVENTION_TYPE_TOKEN_COLORS) :
// ménage #2F9E8D (--menage) · maintenance/réparation #4F86C6 (--maintenance).
export const CLEANING_TYPE_COLOR = '#2F9E8D';
export const MAINTENANCE_TYPE_COLOR = '#4F86C6';

const CLEANING_TYPES = new Set([
  'CLEANING', 'EXPRESS_CLEANING', 'DEEP_CLEANING', 'WINDOW_CLEANING',
  'FLOOR_CLEANING', 'KITCHEN_CLEANING', 'BATHROOM_CLEANING',
  'EXTERIOR_CLEANING', 'DISINFECTION',
]);

export function isCleaningType(type: string): boolean {
  return CLEANING_TYPES.has(type?.toUpperCase());
}

/** Couleur data du type (ménage vs maintenance) + fond soft dérivé color-mix. */
export function getTypeTokens(type: string): SoftTokens {
  const color = isCleaningType(type) ? CLEANING_TYPE_COLOR : MAINTENANCE_TYPE_COLOR;
  return { color, bg: `color-mix(in srgb, ${color} 12%, transparent)` };
}

// Types
export interface InterventionDetailsData {
  id: number;
  title: string;
  description: string;
  type: string;
  status: string;
  priority: string;
  propertyId: number;
  propertyName: string;
  propertyAddress: string;
  propertyCity: string;
  propertyPostalCode: string;
  propertyCountry: string;
  requestorId?: number;
  requestorName: string;
  assignedToId?: number;
  assignedToType: 'user' | 'team';
  assignedToName: string;
  assignedUserRole?: string;
  scheduledDate: string;
  estimatedDurationHours: number;
  actualDurationMinutes: number;
  estimatedCost: number;
  /** Prix conseil plateforme (moteur ménage) snapshoté à la création. */
  recommendedCost?: number;
  actualCost: number;
  notes: string;
  photos: string;
  progressPercentage: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string;
  startTime?: string;
  endTime?: string;
  beforePhotosUrls?: string;
  afterPhotosUrls?: string;
  beforePhotoIds?: string;
  afterPhotoIds?: string;
  completedSteps?: string;
  validatedRooms?: string;
  paymentStatus?: string;
}

export interface PropertyDetails {
  bedroomCount?: number;
  bathroomCount?: number;
  livingRooms?: number;
  kitchens?: number;
}

export type StepType = 'inspection' | 'rooms' | 'after_photos';

export interface StepNotes {
  inspection?: string;
  rooms?: { [key: number]: string; general?: string };
  after_photos?: string;
}

// Local utility functions (not duplicated in shared utils)
export const parsePhotos = (photosString: string | undefined): string[] => {
  if (!photosString) return [];
  try {
    if (photosString.trim().startsWith('[')) {
      const parsed = JSON.parse(photosString);
      return Array.isArray(parsed) ? parsed : [photosString];
    } else {
      return photosString.split(',').filter(url => url.trim() !== '');
    }
  } catch {
    return [photosString];
  }
};
