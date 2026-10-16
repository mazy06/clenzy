import { apiClient, type PaginatedResponse } from '@/api/apiClient';
import { resolveCatalogProvider,type CatalogProvider } from '@/features/marketplace/api';
export interface NetworkLink { id: number; providerId: number; providerName?: string; organizationName: string;
  status: 'INVITED' | 'ACTIVE' | 'REVOKED' | 'EXPIRED'; expiresAt?: string; provider?: CatalogProvider }
export const networkApi = {
  members: (page: number, signal?: AbortSignal) => apiClient.get<PaginatedResponse<CatalogProvider>>('/mobile/network/members', { params: { page }, signal }).then(result=>({...result,content:result.content.map(resolveCatalogProvider)})),
  list: (received: boolean, page: number, signal?: AbortSignal) => apiClient.get<PaginatedResponse<NetworkLink>>('/mobile/network', { params: { received, page }, signal }),
  invite: (providerId: number) => apiClient.post<{ link: NetworkLink; url: string }>('/mobile/network', { providerId }),
  acceptToken: (token: string) => apiClient.post<NetworkLink>('/mobile/network/accept-token', { token }),
  accept: (id: number) => apiClient.post<NetworkLink>(`/mobile/network/${id}/accept`),
  leave: (id: number) => apiClient.post<NetworkLink>(`/mobile/network/${id}/leave`),
  revoke: (id: number) => apiClient.delete(`/mobile/network/${id}`),
};
