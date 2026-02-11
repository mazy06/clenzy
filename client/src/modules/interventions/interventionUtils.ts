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
  requestorId: number;
  requestorName: string;
  assignedToId: number;
  assignedToType: 'user' | 'team';
  assignedToName: string;
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
  completedSteps?: string;
  validatedRooms?: string;
  paymentStatus?: string;
}

export type ChipColor = 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';

export interface PropertyDetails {
  bedroomCount?: number;
  bathroomCount?: number;
  bedrooms?: number;
  bathrooms?: number;
  livingRooms?: number;
  kitchens?: number;
}

export type StepType = 'inspection' | 'rooms' | 'after_photos';

export interface StepNotes {
  inspection?: string;
  rooms?: { [key: number]: string; general?: string };
  after_photos?: string;
}

// Utility functions
export const getStatusColor = (status: string): ChipColor => {
  switch (status) {
    case 'PENDING': return 'warning';
    case 'IN_PROGRESS': return 'info';
    case 'COMPLETED': return 'success';
    case 'CANCELLED': return 'error';
    default: return 'default';
  }
};

export const getStatusLabel = (status: string) => {
  switch (status) {
    case 'PENDING': return 'En attente';
    case 'IN_PROGRESS': return 'En cours';
    case 'COMPLETED': return 'Terminé';
    case 'CANCELLED': return 'Annulé';
    default: return status;
  }
};

export const getPriorityColor = (priority: string): ChipColor => {
  switch (priority) {
    case 'LOW': return 'success';
    case 'NORMAL': return 'info';
    case 'HIGH': return 'warning';
    case 'URGENT': return 'error';
    default: return 'default';
  }
};

export const getPriorityLabel = (priority: string) => {
  switch (priority) {
    case 'LOW': return 'Basse';
    case 'NORMAL': return 'Normale';
    case 'HIGH': return 'Haute';
    case 'URGENT': return 'Urgente';
    default: return priority;
  }
};

export const getTypeLabel = (type: string) => {
  switch (type) {
    case 'CLEANING': return 'Nettoyage';
    case 'EXPRESS_CLEANING': return 'Nettoyage Express';
    case 'DEEP_CLEANING': return 'Nettoyage en Profondeur';
    case 'WINDOW_CLEANING': return 'Nettoyage des Vitres';
    case 'FLOOR_CLEANING': return 'Nettoyage des Sols';
    case 'KITCHEN_CLEANING': return 'Nettoyage de la Cuisine';
    case 'BATHROOM_CLEANING': return 'Nettoyage des Sanitaires';
    case 'PREVENTIVE_MAINTENANCE': return 'Maintenance Préventive';
    case 'EMERGENCY_REPAIR': return 'Réparation d\'Urgence';
    case 'ELECTRICAL_REPAIR': return 'Réparation Électrique';
    case 'PLUMBING_REPAIR': return 'Réparation Plomberie';
    case 'HVAC_REPAIR': return 'Réparation Climatisation';
    case 'INSPECTION': return 'Inspection';
    default: return type;
  }
};

export const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const formatDuration = (hours: number) => {
  if (hours === 1) return '1 heure';
  return `${hours} heures`;
};

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR'
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
