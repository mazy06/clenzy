import apiClient from '../apiClient';
export interface BaitlyMissionSafetyState {
  pausedAt: string | null; pauseSeconds: number;
  contacts: { role: string; name: string; phone?: string }[];
  furniture: { id: number; name: string }[];
  incidents: { id: number; title: string; description: string; status: string; date: string }[];
}
export const baitlyMissionSafetyApi = {
  photos: (id: number,issueId: number) => apiClient.get<string[]>(`/mobile/missions/${id}/damage/${issueId}/photos`),
  get: (id: number) => apiClient.get<BaitlyMissionSafetyState>(`/mobile/missions/${id}/safety`),
  action: (id: number, action: 'pause' | 'resume' | 'damage', body?: { cause: string; room: string; furnitureId?: number; detail: string; elementCategory?: string; elementCode?: string; elementName?: string }) => apiClient.post<BaitlyMissionSafetyState>(`/mobile/missions/${id}/${action}`, body),
};
