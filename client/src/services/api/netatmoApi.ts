import apiClient from '../apiClient';

// ─── Types (backend /api/netatmo) ────────────────────────────────────────────

export interface NetatmoConnectionStatus {
  connected: boolean;
  status: string;
  connectedAt: string | null;
  lastSyncAt: string | null;
  errorMessage: string | null;
  deviceCount: number;
}

// ─── Netatmo OAuth API ────────────────────────────────────────────────────────

export const netatmoApi = {
  /** Initier la connexion OAuth Netatmo (retourne l'URL d'autorisation). */
  connect() {
    return apiClient.get<{ authorization_url?: string; status: string; message?: string }>(
      '/netatmo/connect',
    );
  },

  /** Déconnecter le compte Netatmo. */
  disconnect() {
    return apiClient.post<{ status: string; message: string }>('/netatmo/disconnect');
  },

  /** Statut de la connexion Netatmo. */
  getStatus() {
    return apiClient.get<NetatmoConnectionStatus>('/netatmo/status');
  },
};
