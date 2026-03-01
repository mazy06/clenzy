import { apiClient, PaginatedResponse } from '../apiClient';

export interface Property {
  id: number;
  name: string;
  description?: string;
  type: string;
  status: string;
  address?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  department?: string;
  arrondissement?: string;
  bedroomCount?: number;
  bathroomCount?: number;
  maxGuests?: number;
  squareMeters?: number;
  nightlyPrice?: number;
  // Cleaning config
  cleaningFrequency?: string;
  cleaningBasePrice?: number;
  cleaningDurationMinutes?: number;
  cleaningNotes?: string;
  numberOfFloors?: number;
  hasExterior?: boolean;
  hasLaundry?: boolean;
  // A la carte services
  windowCount?: number;
  frenchDoorCount?: number;
  slidingDoorCount?: number;
  hasIroning?: boolean;
  hasDeepKitchen?: boolean;
  hasDisinfection?: boolean;
  // Amenities
  amenities?: string[];
  // Airbnb integration
  airbnbListingId?: string;
  airbnbUrl?: string;
  // Contract
  maintenanceContract?: boolean;
  // Emergency
  emergencyContact?: string;
  emergencyPhone?: string;
  // Traveler instructions
  accessInstructions?: string;
  specialRequirements?: string;
  defaultCheckInTime?: string;
  defaultCheckOutTime?: string;
  // Owner / Manager
  ownerId?: number;
  ownerName?: string;
  managerId?: number;
  managerFirstName?: string;
  managerLastName?: string;
  managerEmail?: string;
  // Photos
  photos?: string[];
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface ChannelStatus {
  linked: boolean;
  syncEnabled: boolean;
  lastSyncAt: string | null;
  status: 'ACTIVE' | 'DISABLED' | 'NOT_LINKED';
}

export interface PropertyChannels {
  airbnb: ChannelStatus;
}

export const propertiesApi = {
  getAll(params?: Record<string, string>) {
    return apiClient.get<PaginatedResponse<Property>>('/properties', { params });
  },

  getById(id: number) {
    return apiClient.get<Property>(`/properties/${id}`);
  },

  getChannels(propertyId: number) {
    return apiClient.get<PropertyChannels>(`/properties/${propertyId}/channels`);
  },
};
