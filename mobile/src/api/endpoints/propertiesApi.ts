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
  // Booking config
  minimumNights?: number;
  defaultCurrency?: string;
  bookingEngineVisible?: boolean;
  // Check-in instructions
  checkInInstructions?: {
    accessCode?: string;
    wifiName?: string;
    wifiPassword?: string;
    parkingInfo?: string;
    arrivalInstructions?: string;
    departureInstructions?: string;
    houseRules?: string;
    emergencyContact?: string;
  };
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

export interface UpdatePropertyData {
  name?: string;
  type?: string;
  description?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  bedroomCount?: number;
  bathroomCount?: number;
  maxGuests?: number;
  squareMeters?: number;
}

export interface UpdateInstructionsData {
  wifiName?: string;
  wifiPassword?: string;
  accessCode?: string;
  parkingInfo?: string;
  checkInTime?: string;
  checkOutTime?: string;
  houseRules?: string;
  emergencyContact?: string;
  specialNotes?: string;
}

/** The server lists photos as `photoUrls`; the app reads `photos`. */
export function normalizeProperty(item: Property & { photoUrls?: string[] }): Property {
  return { ...item, photos: item.photos ?? item.photoUrls ?? [] };
}

export const propertiesApi = {
  async getAll(params?: Record<string, string>) {
    const page = await apiClient.get<PaginatedResponse<Property>>('/properties', { params });
    return { ...page, content: page.content.map(normalizeProperty) };
  },

  async getById(id: number) {
    return normalizeProperty(await apiClient.get<Property>(`/properties/${id}`));
  },

  update(id: number, data: UpdatePropertyData) {
    return apiClient.put<Property>(`/properties/${id}`, data);
  },

  getChannels(propertyId: number) {
    return apiClient.get<PropertyChannels>(`/properties/${propertyId}/channels`);
  },

  getPhotos(propertyId: number) {
    return apiClient.get<PropertyPhotoMeta[]>(`/properties/${propertyId}/photos`);
  },

  getPhotoUrl(propertyId: number, photoId: number) {
    return `/api/properties/${propertyId}/photos/${photoId}/data`;
  },

  uploadPhoto(propertyId: number, formData: FormData) {
    return apiClient.upload<PropertyPhotoMeta>(`/properties/${propertyId}/photos`, formData);
  },

  deletePhoto(propertyId: number, photoId: number) {
    return apiClient.delete(`/properties/${propertyId}/photos/${photoId}`);
  },

  /**
   * Guest instructions live in the check-in instructions resource, times on the property. The server
   * replaces the whole instructions record, so unchanged fields (photos, door options) are sent back as read.
   */
  async updateInstructions(propertyId: number, data: UpdateInstructionsData) {
    const current = await apiClient.get<Record<string, unknown> | null>(`/properties/${propertyId}/check-in-instructions`);
    await apiClient.put(`/properties/${propertyId}/check-in-instructions`, {
      ...(current ?? {}), accessCode: data.accessCode, wifiName: data.wifiName, wifiPassword: data.wifiPassword,
      parkingInfo: data.parkingInfo, houseRules: data.houseRules, emergencyContact: data.emergencyContact, additionalNotes: data.specialNotes,
      accessCodeAutoRotate: !!current?.accessCodeAutoRotate, guestUnlockEnabled: !!current?.guestUnlockEnabled,
    });
    if (data.checkInTime || data.checkOutTime) await apiClient.put(`/properties/${propertyId}`, { defaultCheckInTime: data.checkInTime || undefined, defaultCheckOutTime: data.checkOutTime || undefined });
  },

  updateAmenities(propertyId: number, amenities: string[]) {
    return apiClient.put<Property>(`/properties/${propertyId}`, { amenities });
  },
};

export interface PropertyPhotoMeta {
  id: number;
  propertyId: number;
  originalFilename: string;
  contentType: string;
  fileSize: number;
  sortOrder: number;
  caption?: string;
  source?: string;
  createdAt: string;
}
