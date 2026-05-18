import apiClient from '../apiClient';

export interface ChannelSyncHealth {
  propertyId: number;
  synced: number;
  total: number;
}

export const channelSyncHealthApi = {
  /**
   * Recupere l'etat de sync multi-canaux pour un batch de proprietes.
   * Retourne un map propertyId → { synced, total }.
   */
  async getHealth(propertyIds: number[]): Promise<Record<string, ChannelSyncHealth>> {
    if (propertyIds.length === 0) return {};
    return apiClient.get<Record<string, ChannelSyncHealth>>('/channel-sync-health', {
      params: { propertyIds: propertyIds.join(',') },
    });
  },
};
