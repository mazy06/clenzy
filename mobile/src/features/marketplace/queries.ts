import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { propertiesApi } from '@/api/endpoints/propertiesApi';
import { marketplaceApi, type QuoteSide, type QuoteStatus } from './api';
import { BAITLY_QUERY_ROOT } from '@/config/baitlyCache';
import { isBaitlyDemoCatalogEnabled } from './baitlyDemoCatalog';
import { useBaitlyDataMode } from '@/config/baitlyDataMode';
import { demoRequest, demoRequestsPage } from './baitlyDemoRequests';
import { useBaitlyUser } from '@/config/baitlyDemoProfiles';
import { baitlyDataMode } from '@/config/baitlyDataMode';
import { demoOwnedProperties } from '@/features/owner/baitlyDemoProperties';

export function useBaitlyScope() {
  const user = useBaitlyUser();
  const mode = useBaitlyDataMode(s => s.mode);
  return [BAITLY_QUERY_ROOT, user?.id, user?.organizationId, mode] as const;
}

export function useCatalog(query: string, category: string, city = '') {
  const scope = useBaitlyScope();
  return useInfiniteQuery({
    queryKey: [...scope, 'catalog', isBaitlyDemoCatalogEnabled() ? 'demo' : 'live', query, category, city],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => marketplaceApi.catalog(query, category, pageParam, signal, city),
    getNextPageParam: last => last.page + 1 < last.totalPages ? last.page + 1 : undefined,
  });
}
export function useCategories() {
  const scope = useBaitlyScope();
  return useQuery({ queryKey: [...scope, 'categories', isBaitlyDemoCatalogEnabled() ? 'demo' : 'live'], queryFn: ({ signal }) => marketplaceApi.categories(signal) });
}
export function useProvider(id: number) {
  const scope = useBaitlyScope();
  return useQuery({ queryKey: [...scope, 'provider', isBaitlyDemoCatalogEnabled() ? 'demo' : 'live', id], queryFn: ({ signal }) => marketplaceApi.provider(id, signal) });
}
export function useProviderReviews(id: number) {
  const scope = useBaitlyScope();
  return useQuery({ queryKey: [...scope, 'provider-reviews', id], queryFn: ({ signal }) => marketplaceApi.reviews(id, signal) });
}
export function useRequests(side: QuoteSide, status?: QuoteStatus) {
  const scope = useBaitlyScope();
  return useInfiniteQuery({
    queryKey: [...scope, 'requests', side, status], initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => isBaitlyDemoCatalogEnabled() ? Promise.resolve(demoRequestsPage(side, status)) : marketplaceApi.requests(side, pageParam, signal, status),
    getNextPageParam: last => last.page + 1 < last.totalPages ? last.page + 1 : undefined,
    retry: false,
  });
}
export function useRequest(id: number) {
  const scope = useBaitlyScope();
  return useQuery({ queryKey: [...scope, 'request', id], queryFn: ({ signal }) => {
    if (isBaitlyDemoCatalogEnabled() && id < 0) {
      const item = demoRequest(id);
      return item ? Promise.resolve(item) : Promise.reject(new Error('Unknown demo request'));
    }
    if (id < 0) return Promise.reject(new Error('Demo request unavailable'));
    return marketplaceApi.request(id, signal);
  } });
}
export function useBaitlyProperties() {
  const scope = useBaitlyScope();
  return useInfiniteQuery({
    queryKey: [...scope, 'properties'], initialPageParam: 0,
    queryFn: ({ pageParam }) => {
      if(baitlyDataMode()==='demo') { const items=demoOwnedProperties();return Promise.resolve({content:items,totalElements:items.length,totalPages:1,number:0,size:20,first:true,last:true}); }
      return propertiesApi.getAll({ page: String(pageParam), size: '20' });
    },
    getNextPageParam: last => last.number + 1 < last.totalPages ? last.number + 1 : undefined,
  });
}
