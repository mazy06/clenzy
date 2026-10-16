import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/apiClient';
import { baitlyDataMode } from '@/config/baitlyDataMode';
import { API_CONFIG } from '@/config/api';
import { useBaitlyScope } from '@/features/marketplace/queries';
import { demoManagementDirectory, demoPublicClient, type DemoPublicClient, type DemoPublicProperty } from '@/features/marketplace/baitlyDemoClients';
import { demoFinancialPerformance } from './demoFinancialPerformance';

export interface PublicProperty extends Omit<DemoPublicProperty, 'type' | 'photos' | 'guestReviews' | 'areaM2' | 'guests' | 'bedrooms' | 'bathrooms'> {
  type: string; areaM2: number | null; guests: number | null; bedrooms: number | null; bathrooms: number | null; photos: string[];
  countryCode?:string|null;department?:string|null;
  guestRatingAvg?:number|null;guestRatingCount?:number;
  guestReviews: { id: string; name: string; avatarUrl?: string | null; portraitIndex?: number; rating: number; date: string; comment: string }[];
}
export interface PublicClient extends Omit<DemoPublicClient, 'demo' | 'portraitIndex' | 'properties'> {
  demo: boolean; portraitIndex?: number; avatarUrl?: string | null; coverUrl?: string | null;
  providerId?: number | null; properties: PublicProperty[];
  annualPerformance?: { year: number; occupancyPct: number; bookedNights?: number; calendarNights?: number }[];
  publishFinancialPerformance?: boolean;
  financialPerformance?: FinancialPerformance[];
}
export interface FinancialPerformance {
  year: number; currency: string; properties: number; bookedNights: number;
  calendarNights?: number; occupancyPct?: number;
  averageNightlyRate?: number; revenuePerCalendarNight?: number; revenueGrowthPct?: number;
  recordedCostMarginPct?: number; financialCoveragePct?: number | null; costCoveragePct?: number | null;
}
export const publicProfilesApi = {
  contact(profileId: string, message: string) {
    if (baitlyDataMode() !== 'real' || profileId.startsWith('baitly-demo-')) return Promise.reject(new Error('Aucun contact réel en démonstration'));
    return apiClient.post<{ id: string; status: 'RECORDED' }>('/mobile/management-contacts', { profileId, message });
  },
  list(role: 'OWNER' | 'CONCIERGE', search: string, signal?: AbortSignal): Promise<PublicClient[]> {
    return baitlyDataMode() === 'demo' ? Promise.resolve(demoManagementDirectory(role, search).map(p => ({ ...p, financialPerformance: demoFinancialPerformance(p) })))
      : apiClient.get<PublicClient[]>('/public/baitly-catalog/profiles', { skipAuth: true, signal, params: { role, query: search } }).then(items => items.map(resolveMedia));
  },
  detail(id: string, signal?: AbortSignal): Promise<PublicClient> {
    if (baitlyDataMode() === 'demo') {
      const profile = demoPublicClient(id);
      return profile ? Promise.resolve({ ...profile, financialPerformance: demoFinancialPerformance(profile) }) : Promise.reject(new Error('Profil indisponible'));
    }
    return apiClient.get<PublicClient>(`/public/baitly-catalog/profiles/${encodeURIComponent(id)}`, { skipAuth: true, signal }).then(resolveMedia);
  },
};
function resolveMedia(profile: PublicClient): PublicClient {
  const url = (value?: string | null) => value ? new URL(value, API_CONFIG.BASE_URL).toString() : value;
  return { ...profile, avatarUrl: url(profile.avatarUrl), coverUrl: url(profile.coverUrl),
    properties: profile.properties.map(p => ({ ...p, photos: p.photos.map(path => url(path)!),
      guestReviews: p.guestReviews.map(r => ({ ...r, avatarUrl: url(r.avatarUrl) })) })) };
}
export function usePublicProfiles(role: 'OWNER' | 'CONCIERGE', query: string, enabled = true) {
  const scope = useBaitlyScope();
  return useQuery({ queryKey: [...scope, 'public-profiles', role, query], queryFn: ({ signal }) => publicProfilesApi.list(role, query, signal), enabled });
}
export function usePublicProfile(id: string) {
  const scope = useBaitlyScope();
  return useQuery({ queryKey: [...scope, 'public-profile', id], queryFn: ({ signal }) => publicProfilesApi.detail(id, signal), retry: false });
}
