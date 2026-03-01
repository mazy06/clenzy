export interface Intervention {
  id: number;
  title: string;
  description: string;
  type: string;
  status: string;
  priority: string;
  propertyId: number;
  propertyType?: string;
  propertyName: string;
  propertyAddress: string;
  propertyCity?: string;
  propertyPostalCode?: string;
  propertyCountry?: string;
  requestorId: number;
  requestorName: string;
  assignedToId: number;
  assignedToType: 'user' | 'team';
  assignedToName: string;
  scheduledDate: string;
  estimatedDurationHours: number;
  actualDurationMinutes?: number;
  progressPercentage: number;
  estimatedCost?: number;
  actualCost?: number;
  notes?: string;
  photosUrl?: string;
  beforePhotosUrls?: string;
  afterPhotosUrls?: string;
  completedSteps?: string;
  validatedRooms?: string;
  paymentStatus?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface InterventionFormData {
  title: string;
  description: string;
  type: string;
  status: string;
  priority: string;
  propertyId: number;
  requestorId: number;
  assignedToId?: number;
  assignedToType?: 'user' | 'team';
  scheduledDate: string;
  estimatedDurationHours: number;
  estimatedCost?: number;
  notes: string;
  photos: string;
  progressPercentage: number;
}

export interface InterventionListParams {
  [key: string]: string | number | boolean | undefined | null;
  propertyId?: number;
  size?: number;
  sort?: string;
}
