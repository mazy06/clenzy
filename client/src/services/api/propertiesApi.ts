import apiClient from '../apiClient';
import { isMockEnabled, setMockEnabled } from '../storageService';
import { extractApiList } from '../../types';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Score de performance d'un logement (fenêtre glissante), cf. backend PropertyPerformanceDto. */
export interface PropertyPerformance {
  propertyId: number;
  /** Nom du logement (pour le classement du dashboard). */
  name: string;
  /** Score global 0–100. */
  score: number;
  /** Revenu par logement disponible = revenu / jours (devise de base EUR). */
  revPan: number;
  /** Taux d'occupation en % (0–100, plafonné). */
  occupancyRate: number;
  /** Revenu de la fenêtre, proraté aux nuits comprises (devise de base EUR). */
  revenue: number;
  /** Coûts d'intervention réels de la fenêtre (devise de base EUR). */
  costs: number;
  /** Marge nette en % (0–100). */
  netMargin: number;
  /** Taille de la fenêtre glissante en jours. */
  windowDays: number;
}

export interface Property {
  id: number;
  name: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  countryCode?: string;
  /** Fuseau IANA du logement (ex: Europe/Paris, Africa/Casablanca). */
  timezone?: string;
  defaultCleaningType?: 'CLEANING' | 'EXPRESS_CLEANING' | 'DEEP_CLEANING';
  /** URL relative de la photo principale (ex: /api/properties/3/photos/12/data). */
  coverPhotoUrl?: string;
  /** URLs relatives de toutes les photos triees (sortOrder, puis id). Vide si aucune photo. */
  photoUrls?: string[];
  type: string;
  status: string;
  bedroomCount: number;
  bathroomCount: number;
  squareMeters: number;
  nightlyPrice: number;
  minimumNights?: number;
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
  // Booking Engine
  bookingEngineVisible?: boolean;
  /** Consentement host pour que l'org gestionnaire cree des vouchers sur ce logement. */
  orgCanCreateVouchers?: boolean;
  // Geolocalisation
  latitude?: number;
  longitude?: number;
  department?: string;
  arrondissement?: string;
  createdAt?: string;
  updatedAt?: string;
  // Instructions voyageur (check-in instructions)
  checkInInstructions?: {
    id: number;
    propertyId: number;
    accessCode: string | null;
    wifiName: string | null;
    wifiPassword: string | null;
    parkingInfo: string | null;
    arrivalInstructions: string | null;
    departureInstructions: string | null;
    houseRules: string | null;
    emergencyContact: string | null;
    additionalNotes: string | null;
    updatedAt: string | null;
  };
}

export interface PropertyFormData {
  name: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  countryCode?: string;
  /** Fuseau IANA du logement (ex: Europe/Paris, Africa/Casablanca). */
  timezone?: string;
  defaultCleaningType?: 'CLEANING' | 'EXPRESS_CLEANING' | 'DEEP_CLEANING';
  type: string;
  status: string;
  bedroomCount: number;
  bathroomCount: number;
  squareMeters: number;
  nightlyPrice: number;
  minimumNights?: number;
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
  // Booking Engine
  bookingEngineVisible?: boolean;
  /** Consentement host pour que l'org gestionnaire cree des vouchers sur ce logement. */
  orgCanCreateVouchers?: boolean;
  // Geolocalisation
  latitude?: number;
  longitude?: number;
  department?: string;
  arrondissement?: string;
}

// ─── Mock Data ──────────────────────────────────────────────────────────────
// Données fictives cohérentes avec les réservations mock de reservationsApi.ts
// (mêmes propertyId 1-10, mêmes noms).

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

// ─── Moteur Ménage : preview (quotes par type + décomposition minutes) ────────

export interface CleaningPreviewInputs {
  bedrooms?: number | null;
  bathrooms?: number | null;
  squareMeters?: number | null;
  floors?: number | null;
  hasExterior?: boolean | null;
  hasLaundry?: boolean | null;
  maxGuests?: number | null;
  /** Types demandés (défaut serveur : EXPRESS_CLEANING, CLEANING, DEEP_CLEANING). */
  cleaningTypes?: string[];
  /** Date de prestation optionnelle (ISO yyyy-MM-dd) — applique la majoration saisonnière. */
  serviceDate?: string | null;
}

export interface CleaningQuoteDto {
  durationMinutes: number;
  recommended: number;
  min: number;
  max: number;
}

export interface CleaningEstimateDetail {
  estimate: number;
  source: 'PROPERTY_OVERRIDE' | 'ENGINE' | 'HOUSEKEEPER_RATE';
  min: number;
  max: number;
  durationMinutes: number;
}

export interface CleaningPreviewResponse {
  quotes: Record<string, CleaningQuoteDto>;
  minutesBreakdown: Record<string, number>;
}

export const propertiesApi = {
  /** Indique si le mode mock analytics est actif. */
  isMockMode(): boolean {
    return isMockEnabled('analytics');
  },

  /** Active ou désactive le mode mock analytics (persisté en localStorage). */
  setMockMode(enabled: boolean): void {
    setMockEnabled('analytics', enabled);
  },

  getAll(params?: { ownerId?: string | number; size?: number; sort?: string }) {
    if (isMockEnabled('analytics')) {
      let data = generateMockProperties();

      if (params?.ownerId) {
        const oid = Number(params.ownerId);
        data = data.filter((p) => p.ownerId === oid);
      }

      return Promise.resolve(data);
    }

    // Backend returns Page<PropertyDto>; unwrap .content to return Property[]
    return apiClient
      .get('/properties', { params: { ...params, size: params?.size ?? 1000 } })
      .then((data) => extractApiList<Property>(data));
  },

  getById(id: number) {
    if (isMockEnabled('analytics')) {
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

  /** Met à jour uniquement le statut (ACTIVE / INACTIVE / UNDER_MAINTENANCE / ARCHIVED) */
  updateStatus(id: number, status: string) {
    return apiClient.patch<Property>(`/properties/${id}/status`, { status });
  },

  /** Score de performance du logement sur une fenêtre glissante (défaut 90 j). */
  getPerformance(id: number, days?: number) {
    const query = days ? `?days=${days}` : '';
    return apiClient.get<PropertyPerformance>(`/properties/${id}/performance${query}`);
  },

  /** Classement de performance des logements ACTIFS de l'org (trié par score décroissant). */
  getPerformanceSummaries(days?: number) {
    const query = days ? `?days=${days}` : '';
    return apiClient.get<PropertyPerformance[]>(`/properties/performance-summaries${query}`);
  },

  /**
   * Estimation du coût de ménage — prix résolu par CleaningPricingEngine :
   * tarif prestataire (FLAT/HOURLY) > prix ménage du logement > conseil moteur
   * (minutes normées × taux horaire, arrondi 5 €, plancher 30 €).
   * Montant proposé (éditable) dans la modale de réservation.
   */
  async getCleaningEstimate(propertyId: number): Promise<number> {
    const res = await apiClient.get<{ estimate: number }>(`/pricing-config/cleaning-estimate/${propertyId}`);
    return res.estimate;
  },

  /** Variante détaillée : prix résolu + provenance + fourchette + durée normée. */
  async getCleaningEstimateDetail(propertyId: number): Promise<CleaningEstimateDetail> {
    return apiClient.get<CleaningEstimateDetail>(`/pricing-config/cleaning-estimate/${propertyId}`);
  },

  /**
   * Estimation ménage EN LOT (une requête pour une liste de logements) :
   * POST /pricing-config/cleaning-estimates → { estimates: { [propertyId]: number } }.
   * Liste vide → {} sans appel réseau.
   */
  /**
   * Preview du Moteur Ménage (valeurs brouillon, sans propriété persistée) :
   * quotes par type de ménage + décomposition des minutes par composant.
   * Utilise la config ENREGISTRÉE côté serveur.
   */
  async previewCleaningEstimate(inputs: CleaningPreviewInputs): Promise<CleaningPreviewResponse> {
    return apiClient.post<CleaningPreviewResponse>('/pricing-config/cleaning-estimate/preview', inputs);
  },

  async getCleaningEstimates(propertyIds: number[]): Promise<Record<number, number>> {
    if (propertyIds.length === 0) return {};
    const res = await apiClient.post<{ estimates: Record<number, number> }>(
      '/pricing-config/cleaning-estimates',
      { propertyIds },
    );
    return res.estimates ?? {};
  },
};
