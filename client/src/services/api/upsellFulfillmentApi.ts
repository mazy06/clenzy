import apiClient from '../apiClient';
import type { CatalogPageDto, CatalogProviderDto } from './providerCatalogApi';

export interface UpsellFulfillment {
  serviceItemCode: string | null;
  overrideCode: string | null;
  preferredProviderId: number | null;
  preferredProvider: CatalogProviderDto | null;
  selectionMode: 'MANUAL';
}
export interface FulfillmentFilters {
  propertyId?: number; start?: string; durationMinutes: number; availableOnly: boolean;
  verifiedOnly: boolean; urgent: boolean; language?: string; sort: string; page: number; related?: boolean;
}
export const upsellFulfillmentApi = {
  get: (id: number) => apiClient.get<UpsellFulfillment>(`/upsells/offers/${id}/fulfillment`),
  configure: (id: number, serviceItemCode: string | null, preferredProviderId: number | null, propertyId?: number) =>
    apiClient.put<UpsellFulfillment>(`/upsells/offers/${id}/fulfillment`, { serviceItemCode, preferredProviderId, propertyId }),
  providers: (id: number, filters: FulfillmentFilters) =>
    apiClient.get<{ page: CatalogPageDto; serviceCodes: string[]; availability: Record<number, 'AVAILABLE' | 'UNAVAILABLE' | 'UNKNOWN'> }>(
      `/upsells/offers/${id}/fulfillment/providers`, { params: { ...filters } }),
};
