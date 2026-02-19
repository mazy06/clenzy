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

// ─── Mock Data ──────────────────────────────────────────────────────────────
// Données fictives cohérentes avec les réservations mock de reservationsApi.ts
// (mêmes propertyId 1-10, mêmes noms).

const ANALYTICS_MOCK_KEY = 'clenzy_analytics_mock';

function generateMockProperties(): Property[] {
  const now = new Date().toISOString();
  return [
    {
      id: 1, name: 'Studio Montmartre', address: '12 Rue Lepic', city: 'Paris 18e',
      postalCode: '75018', country: 'France', type: 'STUDIO', status: 'ACTIVE',
      bedroomCount: 1, bathroomCount: 1, squareMeters: 28, nightlyPrice: 90,
      description: 'Studio charmant au coeur de Montmartre', maxGuests: 2,
      cleaningFrequency: 'AFTER_CHECKOUT', ownerId: 1, ownerName: 'Pierre Martin',
      defaultCheckInTime: '15:00', defaultCheckOutTime: '11:00',
      department: '75', arrondissement: '18e', latitude: 48.8867, longitude: 2.3383,
      createdAt: now, updatedAt: now,
    },
    {
      id: 2, name: 'Appart. Marais', address: '8 Rue de Turenne', city: 'Paris 3e',
      postalCode: '75003', country: 'France', type: 'APARTMENT', status: 'ACTIVE',
      bedroomCount: 2, bathroomCount: 1, squareMeters: 55, nightlyPrice: 160,
      description: 'Bel appartement dans le Marais historique', maxGuests: 4,
      cleaningFrequency: 'AFTER_CHECKOUT', ownerId: 1, ownerName: 'Pierre Martin',
      defaultCheckInTime: '14:00', defaultCheckOutTime: '11:00',
      department: '75', arrondissement: '3e', latitude: 48.8566, longitude: 2.3652,
      createdAt: now, updatedAt: now,
    },
    {
      id: 3, name: 'Loft Bastille', address: '25 Rue de la Roquette', city: 'Paris 11e',
      postalCode: '75011', country: 'France', type: 'LOFT', status: 'ACTIVE',
      bedroomCount: 2, bathroomCount: 1, squareMeters: 65, nightlyPrice: 140,
      description: 'Loft industriel rénové près de la Bastille', maxGuests: 4,
      cleaningFrequency: 'AFTER_CHECKOUT', ownerId: 2, ownerName: 'Sophie Durand',
      defaultCheckInTime: '15:00', defaultCheckOutTime: '10:00',
      department: '75', arrondissement: '11e', latitude: 48.8534, longitude: 2.3744,
      createdAt: now, updatedAt: now,
    },
    {
      id: 4, name: 'Maison Vincennes', address: '5 Avenue du Château', city: 'Vincennes',
      postalCode: '94300', country: 'France', type: 'HOUSE', status: 'ACTIVE',
      bedroomCount: 4, bathroomCount: 2, squareMeters: 120, nightlyPrice: 200,
      description: 'Grande maison familiale à Vincennes', maxGuests: 8,
      cleaningFrequency: 'AFTER_CHECKOUT', ownerId: 2, ownerName: 'Sophie Durand',
      defaultCheckInTime: '16:00', defaultCheckOutTime: '11:00',
      hasExterior: true, numberOfFloors: 2,
      department: '94', latitude: 48.8474, longitude: 2.4392,
      createdAt: now, updatedAt: now,
    },
    {
      id: 5, name: 'Studio Saint-Germain', address: '18 Rue de Seine', city: 'Paris 6e',
      postalCode: '75006', country: 'France', type: 'STUDIO', status: 'ACTIVE',
      bedroomCount: 1, bathroomCount: 1, squareMeters: 32, nightlyPrice: 110,
      description: 'Studio élégant à Saint-Germain-des-Prés', maxGuests: 2,
      cleaningFrequency: 'AFTER_CHECKOUT', ownerId: 3, ownerName: 'Marie Lefevre',
      defaultCheckInTime: '14:00', defaultCheckOutTime: '10:00',
      department: '75', arrondissement: '6e', latitude: 48.8544, longitude: 2.3374,
      createdAt: now, updatedAt: now,
    },
    {
      id: 6, name: 'Appart. Opera', address: '3 Rue Scribe', city: 'Paris 9e',
      postalCode: '75009', country: 'France', type: 'APARTMENT', status: 'ACTIVE',
      bedroomCount: 2, bathroomCount: 1, squareMeters: 60, nightlyPrice: 150,
      description: 'Appartement haussmannien près de l\'Opéra', maxGuests: 4,
      cleaningFrequency: 'AFTER_CHECKOUT', ownerId: 3, ownerName: 'Marie Lefevre',
      defaultCheckInTime: '15:00', defaultCheckOutTime: '11:00',
      department: '75', arrondissement: '9e', latitude: 48.8714, longitude: 2.3312,
      createdAt: now, updatedAt: now,
    },
    {
      id: 7, name: 'Villa Neuilly', address: '42 Boulevard d\'Inkermann', city: 'Neuilly-sur-Seine',
      postalCode: '92200', country: 'France', type: 'VILLA', status: 'ACTIVE',
      bedroomCount: 5, bathroomCount: 3, squareMeters: 200, nightlyPrice: 350,
      description: 'Villa de luxe avec jardin et piscine', maxGuests: 10,
      cleaningFrequency: 'AFTER_CHECKOUT', ownerId: 1, ownerName: 'Pierre Martin',
      defaultCheckInTime: '16:00', defaultCheckOutTime: '11:00',
      hasExterior: true, numberOfFloors: 2,
      department: '92', latitude: 48.8846, longitude: 2.2680,
      createdAt: now, updatedAt: now,
    },
    {
      id: 8, name: 'Duplex Châtelet', address: '10 Rue de Rivoli', city: 'Paris 1er',
      postalCode: '75001', country: 'France', type: 'DUPLEX', status: 'ACTIVE',
      bedroomCount: 3, bathroomCount: 2, squareMeters: 85, nightlyPrice: 180,
      description: 'Duplex moderne face au Châtelet', maxGuests: 6,
      cleaningFrequency: 'AFTER_CHECKOUT', ownerId: 2, ownerName: 'Sophie Durand',
      defaultCheckInTime: '15:00', defaultCheckOutTime: '10:00',
      numberOfFloors: 2,
      department: '75', arrondissement: '1er', latitude: 48.8568, longitude: 2.3470,
      createdAt: now, updatedAt: now,
    },
    {
      id: 9, name: 'T2 Nation', address: '22 Rue de Picpus', city: 'Paris 12e',
      postalCode: '75012', country: 'France', type: 'APARTMENT', status: 'ACTIVE',
      bedroomCount: 1, bathroomCount: 1, squareMeters: 38, nightlyPrice: 95,
      description: 'T2 fonctionnel proche de Nation', maxGuests: 3,
      cleaningFrequency: 'AFTER_CHECKOUT', ownerId: 3, ownerName: 'Marie Lefevre',
      defaultCheckInTime: '14:00', defaultCheckOutTime: '11:00',
      department: '75', arrondissement: '12e', latitude: 48.8462, longitude: 2.3969,
      createdAt: now, updatedAt: now,
    },
    {
      id: 10, name: 'Penthouse Trocadéro', address: '1 Place du Trocadéro', city: 'Paris 16e',
      postalCode: '75016', country: 'France', type: 'PENTHOUSE', status: 'ACTIVE',
      bedroomCount: 3, bathroomCount: 2, squareMeters: 150, nightlyPrice: 500,
      description: 'Penthouse d\'exception vue Tour Eiffel', maxGuests: 6,
      cleaningFrequency: 'AFTER_CHECKOUT', ownerId: 1, ownerName: 'Pierre Martin',
      defaultCheckInTime: '16:00', defaultCheckOutTime: '11:00',
      department: '75', arrondissement: '16e', latitude: 48.8626, longitude: 2.2877,
      createdAt: now, updatedAt: now,
    },
  ];
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const propertiesApi = {
  /** Indique si le mode mock analytics est actif. */
  isMockMode(): boolean {
    return localStorage.getItem(ANALYTICS_MOCK_KEY) === 'true';
  },

  /** Active ou désactive le mode mock analytics (persisté en localStorage). */
  setMockMode(enabled: boolean): void {
    localStorage.setItem(ANALYTICS_MOCK_KEY, enabled ? 'true' : 'false');
  },

  getAll(params?: { ownerId?: string | number; size?: number; sort?: string }) {
    if (localStorage.getItem(ANALYTICS_MOCK_KEY) === 'true') {
      let data = generateMockProperties();

      if (params?.ownerId) {
        const oid = Number(params.ownerId);
        data = data.filter((p) => p.ownerId === oid);
      }

      return Promise.resolve(data);
    }

    return apiClient.get<Property[]>('/properties', { params });
  },

  getById(id: number) {
    if (localStorage.getItem(ANALYTICS_MOCK_KEY) === 'true') {
      const found = generateMockProperties().find((p) => p.id === id);
      if (found) return Promise.resolve(found);
    }

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
