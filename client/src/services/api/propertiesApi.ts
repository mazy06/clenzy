import apiClient from '../apiClient';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Property {
  id: number;
  name: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  type: string;
  status: string;
  bedroomCount: number;
  bathroomCount: number;
  squareMeters: number;
  nightlyPrice: number;
  description: string;
  maxGuests: number;
  cleaningFrequency: string;
  ownerId: number;
  ownerName?: string;
  defaultCheckInTime?: string;
  defaultCheckOutTime?: string;
  // Tarification ménage
  cleaningBasePrice?: number;
  cleaningDurationMinutes?: number;
  numberOfFloors?: number;
  hasExterior?: boolean;
  hasLaundry?: boolean;
  // Prestations à la carte
  windowCount?: number;
  frenchDoorCount?: number;
  slidingDoorCount?: number;
  hasIroning?: boolean;
  hasDeepKitchen?: boolean;
  hasDisinfection?: boolean;
  amenities?: string[];
  cleaningNotes?: string;
  // Geolocalisation
  latitude?: number;
  longitude?: number;
  department?: string;
  arrondissement?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PropertyFormData {
  name: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  type: string;
  status: string;
  bedroomCount: number;
  bathroomCount: number;
  squareMeters: number;
  nightlyPrice: number;
  description: string;
  maxGuests: number;
  cleaningFrequency: string;
  ownerId: number;
  defaultCheckInTime?: string;
  defaultCheckOutTime?: string;
  // Tarification ménage
  cleaningBasePrice?: number;
  numberOfFloors?: number;
  hasExterior?: boolean;
  hasLaundry?: boolean;
  // Prestations à la carte
  windowCount?: number;
  frenchDoorCount?: number;
  slidingDoorCount?: number;
  hasIroning?: boolean;
  hasDeepKitchen?: boolean;
  hasDisinfection?: boolean;
  amenities?: string[];
  cleaningNotes?: string;
  // Geolocalisation
  latitude?: number;
  longitude?: number;
  department?: string;
  arrondissement?: string;
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const propertiesApi = {
  getAll(params?: { ownerId?: string | number; size?: number; sort?: string }) {
    return apiClient.get<Property[]>('/properties', { params });
  },

  getById(id: number) {
    return apiClient.get<Property>(`/properties/${id}`);
  },

  canAssign(id: number) {
    return apiClient.get<boolean>(`/properties/${id}/can-assign`);
  },

  create(data: PropertyFormData) {
    return apiClient.post<Property>('/properties', data);
  },

  update(id: number, data: PropertyFormData) {
    return apiClient.put<Property>(`/properties/${id}`, data);
  },

  delete(id: number) {
    return apiClient.delete(`/properties/${id}`);
  },
};
