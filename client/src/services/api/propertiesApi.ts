import apiClient from '../apiClient';
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
  getAll(params?: { ownerId?: string | number; size?: number; sort?: string }) {
    // Backend returns Page<PropertyDto>; unwrap .content to return Property[]
    return apiClient
      .get('/properties', { params: { ...params, size: params?.size ?? 1000 } })
      .then((data) => extractApiList<Property>(data));
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
