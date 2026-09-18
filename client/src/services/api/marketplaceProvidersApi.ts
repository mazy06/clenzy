import apiClient from '../apiClient';
import { API_CONFIG } from '../../config/api';
import { getAccessToken } from '../../keycloak';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ProviderStatus =
  | 'PENDING_REVIEW'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'REJECTED'
  | 'ARCHIVED';

export type EngagementMode = 'INDEPENDENT' | 'AFFILIATED' | 'EXCLUSIVE';

export type PricingModel = import('../../types/providerPricing').ProviderPricingModel;

export type ProviderSource = 'LANDING' | 'ADMIN' | 'INVITATION' | 'PROSPECT';

/** Famille d'un métier : groupe les pastilles de filtre, illisibles à 32 sur une ligne. */
export type CategoryFamily = 'OPERATIONS' | 'TECHNICAL' | 'GUEST' | 'OWNER' | 'OTHER';

/** Rythme d'une prestation — ce qui la transforme en échéance, donc en relance. */
export type ServiceRecurrence =
  | 'ONE_OFF' | 'PER_STAY' | 'WEEKLY' | 'MONTHLY' | 'SEASONAL' | 'ANNUAL' | 'MULTI_YEAR';

/** Qui paie — décide du chemin comptable. */
export type ServicePayer = 'OWNER' | 'GUEST' | 'AGENCY';

/** Prestation type du catalogue. */
export interface ServiceItemDto {
  id: number;
  code: string;
  categoryCode: string;
  labelFr: string;
  labelEn: string;
  description?: string;
  defaultPricingModel: PricingModel;
  recurrence: ServiceRecurrence;
  payer: ServicePayer;
  /** Peut devenir une vente additionnelle au voyageur. */
  guestSellable: boolean;
  /** Imposée par la loi : diagnostics, ramonage, chaudière, sécurité piscine… */
  regulated: boolean;
  sortOrder: number;
}

export interface ServiceCategoryDto {
  id: number;
  code: string;
  labelFr: string;
  labelEn: string;
  description?: string;
  iconKey?: string;
  family: CategoryFamily;
  /** Métier usuel : reste en tête du filtre même sans prestataire. */
  common: boolean;
  sortOrder: number;
  /** Prestations du métier, servies avec lui en un seul appel. */
  items: ServiceItemDto[];
}

export interface ProviderOfferDto {
  id: number;
  categoryCode: string;
  categoryLabelFr: string;
  categoryLabelEn: string;
  categoryIconKey?: string;
  label: string;
  description?: string;
  pricingModel: PricingModel;
  /** Absent quand `pricingModel` vaut ON_QUOTE — afficher « sur devis », jamais 0. */
  amount?: number;
  currency: string;
  unitLabel?: string;
  minDurationMinutes?: number;
  active: boolean;

  /** Code du catalogue — absent pour une prestation hors référentiel. */
  serviceItemCode?: string;
  recurrence?: ServiceRecurrence;
  payer?: ServicePayer;
  regulated: boolean;
}

export interface ProviderZoneDto {
  id: number;
  countryCode: string;
  department?: string;
  arrondissement?: string;
  city?: string;
  postalCode?: string;
  radiusKm?: number;
  primary: boolean;
}

export interface ProviderAvailabilityDto {
  id: number;
  /** ISO-8601 : 1 = lundi, 7 = dimanche. */
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface ProviderSummaryDto {
  id: number;
  publicRef: string;
  displayName: string;
  legalName?: string;
  headline?: string;
  avatarUrl?: string;
  email: string;
  phone?: string;

  baseCity?: string;
  basePostalCode?: string;
  baseCountryCode: string;
  travelRadiusKm?: number;
  coverageCities: string[];

  status: ProviderStatus;
  engagementMode: EngagementMode;
  homeOrganizationId?: number;
  homeOrganizationName?: string;

  categoryCodes: string[];
  offerCount: number;
  priceFrom?: number;
  currency: string;

  ratingAvg?: number;
  ratingCount: number;
  completedMissions: number;
  acceptsUrgent: boolean;
  languages: string[];

  verified: boolean;
  complianceAlert: boolean;
  insuranceExpiresAt?: string;
  vigilanceExpiresAt?: string;

  /** Vide = aucune contrainte declaree, donc disponible. */
  availableDays: number[];
  weeklyRestricted?: boolean;

  submittedAt?: string;
  createdAt: string;
}

export interface ProviderDetailDto extends Omit<ProviderSummaryDto,
  'categoryCodes' | 'offerCount' | 'priceFrom' | 'coverageCities' | 'availableDays'> {
  contactFirstName?: string;
  contactLastName?: string;
  website?: string;
  bio?: string;

  baseAddress?: string;
  latitude?: number;
  longitude?: number;

  source: ProviderSource;
  userId?: number;

  registrationNumber?: string;
  vatNumber?: string;
  insuranceCompany?: string;
  insurancePolicyNumber?: string;

  minimumCharge?: number;
  travelFee?: number;
  leadTimeHours?: number;
  cancellationNoticeHours?: number;

  acceptanceRatePct?: number;
  avgResponseMinutes?: number;

  verifiedAt?: string;
  reviewNote?: string;

  /** Réponse déjà adressée au candidat, et sa date d'envoi. */
  decisionMessage?: string;
  decisionSentAt?: string;

  /** Vide = adresse jamais prouvée : la fiche ne peut pas être publiée. */
  emailConfirmedAt?: string;

  /** Version des conditions acceptées. Absente sur une fiche reprise d'un compte interne. */
  termsVersion?: string;
  termsAcceptedAt?: string;

  activatedAt?: string;
  suspendedAt?: string;
  lastActiveAt?: string;
  updatedAt?: string;

  offers: ProviderOfferDto[];
  zones: ProviderZoneDto[];
  availability: ProviderAvailabilityDto[];
}

export interface ProviderProvisioningState {
  status: 'PENDING' | 'RUNNING' | 'RETRY' | 'SUCCEEDED' | 'FAILED';
  attempts: number;
  updatedAt: string;
  lastOutcome: 'ACCOUNT_CREATED' | 'EXISTING_ACCOUNT_LINKED' | 'ALREADY_LINKED' | 'FAILED' | null;
  requiresReview: boolean;
}

export interface ProviderInvitationState {
  status: 'PENDING' | 'RUNNING' | 'RETRY' | 'PAUSED' | 'SENT' | 'CANCELLED' | 'EXPIRED';
  attempts: number;
  updatedAt: string;
  nextAttemptAt: string | null;
  sentAt: string | null;
  expiresAt: string;
  linkAvailable: boolean;
}

export interface ProviderPageDto {
  items: ProviderSummaryDto[];
  page: number;
  size: number;
  total: number;
  totalPages: number;
}

export interface MarketplaceStatsDto {
  total: number;
  pendingReview: number;
  active: number;
  suspended: number;
  rejected: number;
  archived: number;
  independent: number;
  affiliated: number;
  exclusive: number;
  complianceAlerts: number;
  /** Comptes prestataires de la plateforme qui n'ont pas encore de fiche. */
  importableUsers: number;
}

/** Un volume pour une valeur de filtre. */
export interface FacetCount {
  key: string;
  count: number;
}

/**
 * Volumes du catalogue par dimension.
 *
 * Ils portent sur l'ENSEMBLE du catalogue, pas sur le sous-ensemble filtré :
 * leur rôle est de dire où chercher, et des comptes qui tomberaient à zéro au
 * fil du filtrage cacheraient les pistes de repli.
 */
export interface MarketplaceFacetsDto {
  categories: FacetCount[];
  services: FacetCount[];
  cities: FacetCount[];
  statuses: FacetCount[];
  engagements: FacetCount[];
}

export interface ImportReport {
  created: number;
  enriched: number;
  unchanged: number;
  skipped: number;
  skippedReasons: string[];
}

/** Tout champ omis signifie « pas de contrainte ». */
export interface ProviderSearchParams {
  query?: string;
  status?: ProviderStatus[];
  engagement?: EngagementMode[];
  category?: string[];
  /** Filtre fin par prestation du catalogue. */
  service?: string[];
  country?: string;
  department?: string;
  city?: string;
  minRating?: number;
  verifiedOnly?: boolean;
  complianceAlert?: boolean;
  acceptsUrgent?: boolean;
  hasOrganization?: boolean;
  organizationId?: number;
  availableOnDay?: number;
  sort?: 'recent' | 'name' | 'rating' | 'missions';
  page?: number;
  size?: number;
}

// ─── Serialisation des parametres ───────────────────────────────────────────

/**
 * Construit la chaine de requete.
 *
 * Les listes sont repetees (`status=ACTIVE&status=SUSPENDED`) — c'est la forme
 * que Spring lie a un `List<T>`. Les valeurs vides sont omises plutot
 * qu'envoyees vides : `city=` aurait ete lu comme « ville vide » et non comme
 * « pas de filtre ».
 */
function buildQuery(params: ProviderSearchParams): string {
  const search = new URLSearchParams();

  const append = (key: string, value: unknown) => {
    if (value === undefined || value === null || value === '') return;
    search.append(key, String(value));
  };

  append('query', params.query?.trim());
  params.status?.forEach((s) => search.append('status', s));
  params.engagement?.forEach((e) => search.append('engagement', e));
  params.category?.forEach((c) => search.append('category', c));
  params.service?.forEach((c) => search.append('service', c));
  append('country', params.country);
  append('department', params.department);
  append('city', params.city);
  append('minRating', params.minRating);
  if (params.verifiedOnly) append('verifiedOnly', true);
  if (params.acceptsUrgent) append('acceptsUrgent', true);
  if (params.complianceAlert !== undefined) append('complianceAlert', params.complianceAlert);
  if (params.hasOrganization !== undefined) append('hasOrganization', params.hasOrganization);
  append('organizationId', params.organizationId);
  append('availableOnDay', params.availableOnDay);
  append('sort', params.sort);
  append('page', params.page);
  append('size', params.size);

  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

// ─── API ────────────────────────────────────────────────────────────────────

const BASE = '/admin/marketplace';

export type ProviderDocumentStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

/**
 * Justificatif déposé par un candidat qui n'a pas encore de compte.
 *
 * La clé de stockage n'y figure pas : le binaire se lit par l'endpoint dédié,
 * jamais par un chemin reconstruit côté navigateur.
 */
export interface ApplicationDocumentDto {
  id: number;
  documentType: 'COMPANY_REGISTRATION' | 'URSSAF_VIGILANCE' | 'LIABILITY_INSURANCE' | 'IDENTITY' | 'OTHER';
  fileName: string;
  fileSize?: number;
  expiresAt?: string;
  status: ProviderDocumentStatus;
  reviewNote?: string;
  createdAt: string;
}

export type ExposureEffect = 'ALLOW' | 'DENY';

/**
 * Une exception à la visibilité par défaut.
 *
 * Une fiche sans règle est visible de toutes les organisations : la liste vide
 * est l'état normal, pas une anomalie.
 */
export interface ExposureRuleDto {
  id: number;
  /** Null = toutes les organisations. */
  organizationId?: number;
  organizationName?: string;
  effect: ExposureEffect;
  reason: string;
  createdAt: string;
}

export const marketplaceProvidersApi = {
  async getInvitation(id: number): Promise<ProviderInvitationState | null> {
    try {
      return await apiClient.get<ProviderInvitationState>(`${BASE}/providers/${id}/activation-delivery`);
    } catch (error) {
      if ((error as { status?: number })?.status === 404) return null;
      throw error;
    }
  },
  async getProvisioning(id: number): Promise<ProviderProvisioningState | null> {
    try {
      return await apiClient.get<ProviderProvisioningState>(`${BASE}/providers/${id}/provisioning`);
    } catch (error) {
      if ((error as { status?: number })?.status === 404) return null;
      throw error;
    }
  },

  retryProvisioning(id: number) {
    return apiClient.post<void>(`${BASE}/providers/${id}/provisioning/retry`);
  },

  search(params: ProviderSearchParams = {}) {
    return apiClient.get<ProviderPageDto>(`${BASE}/providers${buildQuery(params)}`);
  },

  getById(id: number) {
    return apiClient.get<ProviderDetailDto>(`${BASE}/providers/${id}`);
  },

  getCategories() {
    return apiClient.get<ServiceCategoryDto[]>(`${BASE}/categories`);
  },

  getCities() {
    return apiClient.get<string[]>(`${BASE}/cities`);
  },

  getStats() {
    return apiClient.get<MarketplaceStatsDto>(`${BASE}/stats`);
  },

  getFacets() {
    return apiClient.get<MarketplaceFacetsDto>(`${BASE}/facets`);
  },

  updateStatus(id: number, status: ProviderStatus, reviewNote?: string, decisionMessage?: string) {
    return apiClient.patch<ProviderDetailDto>(`${BASE}/providers/${id}/status`, {
      status,
      reviewNote,
      decisionMessage,
    });
  },

  /**
   * Reprend les comptes prestataires existants dans le catalogue.
   *
   * Rejouable : l'import ne remplace aucun champ deja renseigne, il comble les
   * trous. `engagement` ne s'applique qu'aux fiches creees.
   */
  importExisting(engagement?: EngagementMode) {
    const qs = engagement ? `?engagement=${engagement}` : '';
    return apiClient.post<ImportReport>(`${BASE}/providers/import${qs}`);
  },

  getDocuments(id: number) {
    return apiClient.get<ApplicationDocumentDto[]>(`${BASE}/providers/${id}/documents`);
  },

  /**
   * Ouvre le binaire d'une pièce dans un onglet.
   *
   * Un `<a href>` ne conviendrait pas : l'endpoint est authentifié et une
   * balise n'emporte pas le jeton. On récupère donc le fichier avec l'en-tête,
   * puis on affiche l'objet local — et on le révoque, faute de quoi le
   * justificatif reste en mémoire de l'onglet.
   */
  async openDocument(id: number, documentId: number): Promise<void> {
    const url = `${API_CONFIG.BASE_URL}${API_CONFIG.BASE_PATH}`
      + `/admin/marketplace/providers/${id}/documents/${documentId}/file`;
    const token = getAccessToken();
    const response = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include',
    });
    if (!response.ok) {
      throw new Error(`Erreur ${response.status} lors de l'ouverture du justificatif`);
    }
    const blobUrl = window.URL.createObjectURL(await response.blob());
    window.open(blobUrl, '_blank', 'noopener');
    // Laisse à l'onglet le temps de lire avant de reprendre la mémoire.
    window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60_000);
  },

  reviewDocument(id: number, documentId: number, status: ProviderDocumentStatus, reviewNote?: string) {
    return apiClient.patch<ApplicationDocumentDto>(
      `${BASE}/providers/${id}/documents/${documentId}`, { status, reviewNote });
  },

  getExposureRules(id: number) {
    return apiClient.get<ExposureRuleDto[]>(`${BASE}/providers/${id}/exposure`);
  },

  setExposureRule(id: number, effect: ExposureEffect, reason: string, organizationId?: number | null) {
    return apiClient.put<ExposureRuleDto>(`${BASE}/providers/${id}/exposure`, {
      organizationId: organizationId ?? null,
      effect,
      reason,
    });
  },

  removeExposureRule(id: number, ruleId: number) {
    return apiClient.delete<void>(`${BASE}/providers/${id}/exposure/${ruleId}`);
  },

  updateEngagement(id: number, engagementMode: EngagementMode, organizationId?: number | null) {
    return apiClient.patch<ProviderDetailDto>(`${BASE}/providers/${id}/engagement`, {
      engagementMode,
      organizationId: organizationId ?? null,
    });
  },
};
