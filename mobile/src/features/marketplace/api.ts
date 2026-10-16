import { apiClient } from '@/api/apiClient';
import { baitlyMediaUrl } from '@/api/baitlyMedia';
import { useAuthStore } from '@/store/authStore';
import { baitlyDemoCatalog, baitlyDemoCategories, baitlyDemoProvider, isBaitlyDemoCatalogEnabled } from './baitlyDemoCatalog';

function catalogAccess() {
  const guest = !useAuthStore.getState().isAuthenticated;
  return { path: guest ? '/public/baitly-catalog' : '/provider-catalog', skipAuth: guest };
}

export interface ServiceItem {
  code: string;
  categoryCode: string;
  labelFr: string;
  labelEn: string;
  executionMode: string;
  propertyRequired: boolean;
  slotRequired: boolean;
}
export interface ServiceCategory {
  code: string;
  labelFr: string;
  labelEn: string;
  items: ServiceItem[];
}
export interface ProviderOffer {
  id: number;
  categoryCode: string;
  label: string;
  description?: string | null;
  pricingModel: string;
  amount?: number | null;
  currency?: string | null;
  unitLabel?: string | null;
  serviceItemCode?: string | null;
  active: boolean;
}
export interface CatalogReview {
  id: string;
  providerId: number;
  clientName: string;
  clientRole: 'OWNER' | 'CONCIERGE' | 'CLIENT';
  clientOrganization: string | null;
  portraitIndex?: number;
  avatarUrl?: string | null;
  clientProfileId: string | null;
  rating: number;
  feedback: string;
  serviceLabel: string;
  reviewedOn: string;
  demo: boolean;
}
export interface CatalogProvider {
  demo?: boolean;
  id: number;
  displayName: string;
  avatarUrl?: string | null;
  headline?: string | null;
  bio?: string | null;
  baseCity?: string | null;
  baseCountryCode?: string | null;
  travelRadiusKm?: number | null;
  demoPosition?: { latitude: number; longitude: number };
  coverageCities: string[];
  languages: string[];
  categoryCodes: string[];
  offers: ProviderOffer[];
  priceFrom?: number | null;
  currency?: string | null;
  verified: boolean;
  acceptsUrgent?: boolean;
  ratingAvg?: number | null;
  ratingCount?: number;
  demoReviews?: CatalogReview[];
  own: boolean;
}
export interface CatalogPage<T> {
  items: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}
export type QuoteStatus = 'SENT' | 'QUOTED' | 'ACCEPTED' | 'DECLINED' | 'TURNED_DOWN' | 'WITHDRAWN' | 'EXPIRED';
export type QuoteSide = 'sent' | 'received';
export interface QuoteRequest {
  id: number;
  status: QuoteStatus;
  providerId: number;
  providerName?: string | null;
  requesterOrganizationName?: string | null;
  title: string;
  message?: string | null;
  propertyId?: number | null;
  desiredDate?: string | null;
  requestedStartTime?: string | null;
  requestedDurationMinutes?: number | null;
  quotedAmount?: number | null;
  quotedCurrency?: string | null;
  quoteMessage?: string | null;
  quoteValidUntil?: string | null;
  expired: boolean;
  interventionId?: number | null;
  decisionReason?: string | null;
}
export interface CreateRequest {
  providerId: number;
  title: string;
  message?: string;
  propertyId?: number;
  categoryCode?: string;
  serviceItemCode?: string;
  desiredDate?: string;
  requestedStartTime?: string;
  requestedDurationMinutes?: number;
}
export interface SubmitQuote {
  amount: string;
  currency: string;
  message?: string;
  validUntil?: string;
  providerTeamId?: number;
}
export type QuoteAction = 'accept' | 'decline' | 'withdraw' | 'turn-down';

export const marketplaceApi = {
  reviews(id: number, signal?: AbortSignal) {
    if (isBaitlyDemoCatalogEnabled()) return Promise.resolve(baitlyDemoProvider(id).demoReviews ?? []);
    if (id < 0) return Promise.reject(new Error('Profil de démonstration désactivé'));
    return apiClient.get<CatalogReview[]>(`/public/baitly-catalog/${id}/reviews`, { skipAuth: true, signal }).then(items => items.map(item => ({...item,avatarUrl:baitlyMediaUrl(item.avatarUrl)})));
  },
  catalog(query: string, category: string, page: number, signal?: AbortSignal, city?: string) {
    if (isBaitlyDemoCatalogEnabled()) return Promise.resolve(baitlyDemoCatalog(query, category, page, city));
    const access = catalogAccess();
    return apiClient.get<CatalogPage<CatalogProvider>>(access.path, {
      params: { query, category, city, page: String(page), size: '20' }, signal, skipAuth: access.skipAuth,
    }).then(page=>({...page,items:page.items.map(resolveCatalogProvider)}));
  },
  categories(signal?: AbortSignal) {
    if (isBaitlyDemoCatalogEnabled()) return Promise.resolve(baitlyDemoCategories);
    const guest = !useAuthStore.getState().isAuthenticated;
    return apiClient.get<ServiceCategory[]>(guest ? '/public/marketplace/categories' : '/provider-catalog/categories', { signal, skipAuth: guest });
  },
  provider(id: number, signal?: AbortSignal) {
    if (id < 0) return isBaitlyDemoCatalogEnabled() ? Promise.resolve(baitlyDemoProvider(id))
      : Promise.reject(new Error('Catalogue de démonstration désactivé'));
    const access = catalogAccess();
    return apiClient.get<CatalogProvider>(`${access.path}/${id}`, { signal, skipAuth: access.skipAuth }).then(resolveCatalogProvider);
  },
  requests(side: QuoteSide, page: number, signal?: AbortSignal, status?: QuoteStatus) {
    return apiClient.get<CatalogPage<QuoteRequest>>(`/quote-requests/${side}`, {
      params: { page: String(page), size: '20', status }, signal,
    });
  },
  request(id: number, signal?: AbortSignal) {
    return apiClient.get<QuoteRequest>(`/quote-requests/${id}`, { signal });
  },
  create(body: CreateRequest) {
    if (body.providerId < 0) return Promise.reject(new Error('Aucune demande réelle pour un profil de démonstration'));
    return apiClient.post<QuoteRequest>('/quote-requests', body);
  },
  decide(id: number, action: QuoteAction, reason?: string) {
    return apiClient.post<QuoteRequest>(`/quote-requests/${id}/${action}`, { reason });
  },
  quote(id: number, body: SubmitQuote) {
    return apiClient.post<QuoteRequest>(`/quote-requests/${id}/quote`, body);
  },
  teams(id: number, signal?: AbortSignal) {
    return apiClient.get<{ selectedTeamId: number | null; options: { id: number; name: string }[] }>(
      `/quote-requests/${id}/teams`, { signal },
    );
  },
  providerAccess(signal?: AbortSignal) {
    return apiClient.get<{ count: number }>('/quote-requests/received/pending-count', { signal });
  },
};
export function resolveCatalogProvider(provider: CatalogProvider): CatalogProvider { return {...provider,avatarUrl:baitlyMediaUrl(provider.avatarUrl)}; }
