import apiClient from '../apiClient';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ICalEventPreview {
  uid: string;
  summary: string;
  dtStart: string; // ISO date
  dtEnd: string;
  description: string;
  type: 'reservation' | 'blocked';
  guestName: string;
  confirmationCode: string;
  nights: number;
}

export interface ICalPreviewRequest {
  url: string;
  propertyId: number;
}

export interface ICalImportRequest {
  url: string;
  propertyId: number;
  sourceName: string;
  autoCreateInterventions: boolean;
}

export interface ICalPreviewResponse {
  events: ICalEventPreview[];
  totalReservations: number;
  totalBlocked: number;
  propertyName: string;
}

export interface ICalImportResponse {
  imported: number;
  skipped: number;
  errors: string[];
  feedId: number;
}

export interface ICalFeed {
  id: number;
  propertyId: number;
  propertyName: string;
  url: string;
  sourceName: string;
  autoCreateInterventions: boolean;
  syncEnabled: boolean;
  lastSyncAt: string;
  lastSyncStatus: string;
  eventsImported: number;
}

export interface ICalAccessCheck {
  allowed: boolean;
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const iCalApi = {
  /**
   * Verifie si l'utilisateur a acces a l'import iCal (forfait Confort/Premium).
   */
  checkAccess() {
    return apiClient.get<ICalAccessCheck>('/ical/check-access');
  },

  /**
   * Previsualise un flux iCal sans import.
   */
  previewFeed(data: ICalPreviewRequest) {
    return apiClient.post<ICalPreviewResponse>('/ical/preview', data);
  },

  /**
   * Importe les reservations depuis un flux iCal.
   */
  importFeed(data: ICalImportRequest) {
    return apiClient.post<ICalImportResponse>('/ical/import', data);
  },

  /**
   * Liste les feeds iCal de l'utilisateur connecte.
   */
  getFeeds() {
    return apiClient.get<ICalFeed[]>('/ical/feeds');
  },

  /**
   * Supprime un feed iCal.
   */
  deleteFeed(id: number) {
    return apiClient.delete(`/ical/feeds/${id}`);
  },

  /**
   * Bascule l'auto-creation d'interventions pour un feed.
   */
  toggleAutoInterventions(id: number) {
    return apiClient.put<ICalFeed>(`/ical/feeds/${id}/toggle-auto`);
  },

  /**
   * Force la synchronisation d'un feed.
   */
  syncFeed(id: number) {
    return apiClient.post<ICalImportResponse>(`/ical/feeds/${id}/sync`);
  },
};
