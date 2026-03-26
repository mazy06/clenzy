// Re-export shared utilities for backward compatibility
export {
  getInterventionStatusColor as getStatusColor,
  getInterventionStatusLabel as getStatusLabel,
  getInterventionStatusHex as getStatusHex,
  getInterventionPriorityColor as getPriorityColor,
  getInterventionPriorityLabel as getPriorityLabel,
  getInterventionPriorityHex as getPriorityHex,
  getInterventionTypeLabel as getTypeLabel,
  getInterventionTypeHex as getTypeHex,
} from '../../utils/statusUtils';
export type { ChipColor } from '../../types';
export { formatDateTime as formatDate, formatDuration } from '../../utils/formatUtils';

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
export const formatCurrency = (amount: number, currency: string = 'EUR') => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
  }).format(amount);
};

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
