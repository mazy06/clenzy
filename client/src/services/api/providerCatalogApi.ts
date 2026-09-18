import apiClient from '../apiClient';
import type { ServiceCategoryDto, ProviderOfferDto } from './marketplaceProvidersApi';

/**
 * Le catalogue des prestataires, vu par une ORGANISATION.
 *
 * Distinct de `marketplaceProvidersApi`, qui sert la console de la plateforme :
 * ce ne sont ni les mêmes droits, ni les mêmes données. Ici, **aucune
 * coordonnée** — un catalogue ouvert à toutes les organisations qui exposerait
 * l'adresse de chaque prestataire serait un annuaire de prospection.
 */

const BASE = '/provider-catalog';

export interface CatalogProviderDto {
  id: number;
  publicRef?: string;
  displayName: string;
  headline?: string;
  bio?: string;
  avatarUrl?: string;

  baseCity?: string;
  travelRadiusKm?: number;
  coverageCities: string[];
  languages: string[];

  categoryCodes: string[];
  offers: ProviderOfferDto[];
  priceFrom?: number;
  currency?: string;

  verified: boolean;
  acceptsUrgent: boolean;
  /** Vrai si la fiche appartient à l'organisation qui regarde. */
  own: boolean;
  ratingAvg?: number | null;
  ratingCount?: number;
}

export interface CatalogPageDto {
  items: CatalogProviderDto[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface CatalogSearchParams {
  propertyId?: number;
  query?: string;
  category?: string[];
  service?: string[];
  city?: string;
  department?: string;
  verifiedOnly?: boolean;
  acceptsUrgent?: boolean;
  availableOnDay?: number;
  sort?: string;
  page?: number;
  size?: number;
}

function buildQuery(params: CatalogSearchParams): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '' || value === false) return;
    if (Array.isArray(value)) {
      value.forEach((item) => search.append(key, String(item)));
    } else {
      search.append(key, String(value));
    }
  });
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export const providerCatalogApi = {
  search(params: CatalogSearchParams = {}) {
    return apiClient.get<CatalogPageDto>(`${BASE}${buildQuery(params)}`);
  },

  getById(id: number) {
    return apiClient.get<CatalogProviderDto>(`${BASE}/${id}`);
  },

  getCategories() {
    return apiClient.get<ServiceCategoryDto[]>(`${BASE}/categories`);
  },
};
