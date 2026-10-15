import { apiClient } from '@/api/apiClient';
import type { CatalogProvider } from '@/features/marketplace/api';
import { baitlyMediaUrl } from '@/api/baitlyMedia';

export interface ConciergePerformance {
  provider: Pick<CatalogProvider, 'id' | 'displayName' | 'avatarUrl' | 'baseCity' | 'coverageCities'>;
  periodStart: string; periodEnd: string; managedProperties: number;
  occupancyPct: number | null; ratingAvg: number | null; ratingCount: number; updatedAt: string;
}
export interface PublicationSettings { published: boolean; eligible: boolean; preview: ConciergePerformance | null }
export const conciergeApi = {
  list: (signal?: AbortSignal) => apiClient.get<ConciergePerformance[]>('/public/concierge-performance', { skipAuth: true, signal }).then(items=>items.map(item=>({...item,provider:{...item.provider,avatarUrl:baitlyMediaUrl(item.provider.avatarUrl)}}))),
  settings: (signal?: AbortSignal) => apiClient.get<PublicationSettings>('/mobile/concierge-performance', { signal }),
  publish: (published: boolean) => apiClient.put<PublicationSettings>('/mobile/concierge-performance', { published }),
};

export function rankConciergeries(items: ConciergePerformance[], query: string, sort: 'occupancy' | 'rating') {
  const search = query.trim().toLocaleLowerCase();
  return items.filter(item => [item.provider.displayName, item.provider.baseCity, ...item.provider.coverageCities]
    .some(value => value?.toLocaleLowerCase().includes(search))).sort((a, b) => {
    const left = sort === 'occupancy' ? a.occupancyPct : a.ratingAvg;
    const right = sort === 'occupancy' ? b.occupancyPct : b.ratingAvg;
    return (right ?? -1) - (left ?? -1) || a.provider.displayName.localeCompare(b.provider.displayName);
  });
}
