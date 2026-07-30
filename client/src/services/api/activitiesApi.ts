import apiClient from '../apiClient';

export type ActivityProvider = 'VIATOR' | 'GETYOURGUIDE' | 'KLOOK';

/** Etat de connexion d'un provider (la clé API n'est jamais renvoyée). */
export interface ActivityConfig {
  provider: string;
  affiliateId: string | null;
  enabled: boolean;
  hasKey: boolean;
  /** Part Baitly (%) retenue sur la commission de ce programme. null = rien retenu. */
  platformCommissionPct: number | null;
}

export interface UpsertActivityConfigRequest {
  apiKey?: string | null;
  affiliateId?: string | null;
  enabled: boolean;
  platformCommissionPct?: number | null;
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

/** Synthèse des commissions d'activités (part hôte / plateforme). */
export interface ActivityCommissionSummary {
  totalGross: number;
  totalHostShare: number;
  totalPlatformShare: number;
  count: number;
  currency: string;
}

/** Une commission d'affiliation enregistree par l'import. */
export interface ImportedAffiliateEarning {
  provider: string;
  externalBookingId: string | null;
  grossCommission: number;
  hostShare: number;
  platformShare: number;
  currency: string;
}

export const activitiesApi = {
  /**
   * Importe un export de conversions telecharge depuis le tableau de bord du
   * programme. Idempotent par reference : reimporter un fichier qui chevauche
   * le precedent ne credite personne deux fois.
   */
  importEarningsCsv: (provider: ActivityProvider, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiClient.post<ImportedAffiliateEarning[]>(
      `/activities/commissions/import/csv?provider=${provider}`,
      form,
    );
  },
  listConfigs: () => apiClient.get<ActivityConfig[]>('/activities/configs'),
  upsertConfig: (provider: ActivityProvider, data: UpsertActivityConfigRequest) =>
    apiClient.put<ActivityConfig>(`/activities/configs/${provider}`, data),
  commissionSummary: () => apiClient.get<ActivityCommissionSummary>('/activities/commissions/summary'),
};
