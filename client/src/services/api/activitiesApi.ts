import apiClient from '../apiClient';

export type ActivityProvider = 'VIATOR' | 'GETYOURGUIDE' | 'KLOOK';

/** Etat de connexion d'un provider (la clé API n'est jamais renvoyée). */
export interface ActivityConfig {
  provider: string;
  affiliateId: string | null;
  enabled: boolean;
  hasKey: boolean;
}

export interface UpsertActivityConfigRequest {
  apiKey?: string | null;
  affiliateId?: string | null;
  enabled: boolean;
}

/** Activité normalisée affichée sur le livret guest. */
export interface Activity {
  provider: string;
  title: string | null;
  imageUrl: string | null;
  price: string | null;
  currency: string | null;
  rating: number | null;
  reviewCount: number | null;
  durationLabel: string | null;
  bookingUrl: string | null;
}

export const activitiesApi = {
  listConfigs: () => apiClient.get<ActivityConfig[]>('/activities/configs'),
  upsertConfig: (provider: ActivityProvider, data: UpsertActivityConfigRequest) =>
    apiClient.put<ActivityConfig>(`/activities/configs/${provider}`, data),
};
