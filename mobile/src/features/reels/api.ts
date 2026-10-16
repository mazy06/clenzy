import { apiClient } from '@/api/apiClient';
import { useBaitlyScope } from '@/features/marketplace/queries';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { baitlyDataMode } from '@/config/baitlyDataMode';

export interface SocialSettings {
  id?: string; displayName: string; instagramUrl?: string | null; tiktokUrl?: string | null; youtubeUrl?: string | null;
  published: boolean; instagramConfigured?: boolean; instagramConnected?: boolean; instagramUsername?: string | null;
}
export interface Reel {
  id: string; instagramMediaId: string; videoUrl?: string | null; thumbnailUrl?: string | null; permalink: string;
  caption: string; published: boolean; createdAt: string; author: SocialSettings;
  creator?: ReelCreator | null;
}
export interface ReelCreator {
  name: string; avatarUrl?: string | null; role?: 'OWNER' | 'CONCIERGE' | 'PROVIDER' | null; city?: string | null;
  publicProfileId?: string | null; providerId?: number | null; offersManagement: boolean; seekingManagement: boolean;
}
export interface InstagramVideo { id: string; caption: string; thumbnailUrl?: string | null; permalink: string }
export const reelsApi = {
  feed(page: number, signal?: AbortSignal) {
    // No invented social posts or external accounts in demo mode.
    return baitlyDataMode() === 'demo' ? Promise.resolve([] as Reel[])
      : apiClient.get<Reel[]>('/public/baitly-catalog/reels', { skipAuth: true, signal, params: { page: String(page) } });
  },
  // Older servers return 204 until the first save. React Query requires a defined result.
  settings: async () => (await apiClient.get<SocialSettings | null>('/mobile/reels/settings')) ?? null,
  saveSettings: (settings: SocialSettings) => apiClient.put<SocialSettings>('/mobile/reels/settings', settings),
  own: () => apiClient.get<Reel[]>('/mobile/reels'),
  connect: () => apiClient.post<{ url: string }>('/mobile/reels/instagram/connect'),
  disconnect: () => apiClient.delete('/mobile/reels/instagram'),
  videos: (after?: string, signal?: AbortSignal) => apiClient.get<{ items: InstagramVideo[]; after?: string | null }>('/mobile/reels/instagram/videos', { signal, params: after ? { after } : {} }),
  publish: (video: InstagramVideo) => apiClient.post<Reel>('/mobile/reels', { instagramMediaId: video.id, caption: video.caption.slice(0, 500), published: true }),
  select: (mediaIds: string[]) => apiClient.put<Reel[]>('/mobile/reels/selection', { mediaIds }),
  remove: (id: string) => apiClient.delete(`/mobile/reels/${encodeURIComponent(id)}`),
};
export function useReels() {
  const scope = useBaitlyScope();
  return useInfiniteQuery({ queryKey: [...scope, 'reels-feed'], initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => reelsApi.feed(pageParam, signal),
    getNextPageParam: (last, pages) => last.length === 20 ? pages.length : undefined });
}
export function useSocialSettings(enabled: boolean) {
  const scope = useBaitlyScope();
  return useQuery({ queryKey: [...scope, 'reels-settings'], queryFn: reelsApi.settings, enabled });
}
