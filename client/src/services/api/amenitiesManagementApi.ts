/**
 * API client pour la gestion des commodites OTA.
 *
 * Mirror de {@code AmenityManagementController} cote backend (5 ressources :
 * unmapped / custom / aliases / ignored / reprocess).
 */
import { apiClient } from '../apiClient';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface UnmappedAmenityDto {
  rawOtaName: string;
  occurrences: number;
  affectedProperties: { id: number; name: string }[];
  otaSources: string[];
}

export interface CustomAmenityDto {
  id: number;
  code: string;
  labelFr: string;
  labelEn: string | null;
  category: string;
  createdAt: string;
  createdByEmail: string | null;
}

export interface AmenityAliasDto {
  id: number;
  rawOtaName: string;
  clenzyCode: string;
  otaSource: string | null;
  createdAt: string;
  createdByEmail: string | null;
}

export interface IgnoredAmenityDto {
  id: number;
  rawOtaName: string;
  otaSource: string | null;
  createdAt: string;
}

export interface ReprocessResult {
  propertiesScanned: number;
  propertiesUpdated: number;
  totalRawAmenitiesProcessed: number;
  totalMappedAdded: number;
  totalIgnoredRemoved: number;
  totalLeftUnmapped: number;
}

/** Item du catalogue Channex (~180 facilities standards). */
export interface ChannexFacilityOption {
  id: string;
  title: string;
  category: string;
}

export interface CreateCustomAmenityRequest {
  labelFr: string;
  labelEn?: string;
  category?: string;
  code?: string;
  createAliasForRaw?: string;
  applyToProperties: boolean;
}

export interface CreateAliasRequest {
  rawOtaName: string;
  clenzyCode: string;
  otaSource?: string;
  applyToProperties: boolean;
}

export interface CreateAliasBulkRequest {
  clenzyCode: string;
  rawOtaNames: string[];
  otaSource?: string;
  applyToProperties: boolean;
}

export interface CreateIgnoredRequest {
  rawOtaName: string;
  otaSource?: string;
  applyToProperties: boolean;
}

// ─── API ────────────────────────────────────────────────────────────────────

const BASE = '/amenity-management';

export const amenitiesManagementApi = {
  // Unmapped
  listUnmapped: () => apiClient.get<UnmappedAmenityDto[]>(`${BASE}/unmapped`),

  // Custom amenities
  listCustom: () => apiClient.get<CustomAmenityDto[]>(`${BASE}/custom`),
  createCustom: (req: CreateCustomAmenityRequest) =>
    apiClient.post<CustomAmenityDto>(`${BASE}/custom`, req),
  deleteCustom: (id: number) => apiClient.delete<void>(`${BASE}/custom/${id}`),

  // Aliases
  listAliases: () => apiClient.get<AmenityAliasDto[]>(`${BASE}/aliases`),
  createAlias: (req: CreateAliasRequest) =>
    apiClient.post<AmenityAliasDto>(`${BASE}/aliases`, req),
  bulkCreateAliases: (req: CreateAliasBulkRequest) =>
    apiClient.post<ReprocessResult>(`${BASE}/aliases/bulk`, req),
  deleteAlias: (id: number) => apiClient.delete<void>(`${BASE}/aliases/${id}`),

  // Ignored
  listIgnored: () => apiClient.get<IgnoredAmenityDto[]>(`${BASE}/ignored`),
  createIgnored: (req: CreateIgnoredRequest) =>
    apiClient.post<IgnoredAmenityDto>(`${BASE}/ignored`, req),
  deleteIgnored: (id: number) => apiClient.delete<void>(`${BASE}/ignored/${id}`),

  // Reprocess (applique aliases + ignored aux properties existantes)
  reprocess: () => apiClient.post<ReprocessResult>(`${BASE}/reprocess`, {}),

  // Catalogue Channex (~180 facilities standards, cache 1h backend)
  listChannexFacilityCatalog: () =>
    apiClient.get<ChannexFacilityOption[]>(`${BASE}/channex-facility-catalog`),
};
