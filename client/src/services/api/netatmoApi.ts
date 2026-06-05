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

/** Statut de configuration de l'app Netatmo. Le secret n'est jamais renvoyé. */
export interface NetatmoConfigStatus {
  configured: boolean;
  clientId: string | null;
  redirectUri: string | null;
}

export interface UpdateNetatmoConfigPayload {
  clientId: string;
  /** Laisser vide pour conserver le secret déjà enregistré. */
  clientSecret?: string;
  redirectUri: string;
}

/** Un module Netatmo découvert (station météo ou module rattaché), pour le picker. */
export interface NetatmoModule {
  id: string;
  name: string;
  type: string;
  stationName: string | null;
  reachable: boolean;
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

  /** Statut de configuration de l'app Netatmo (credentials plateforme). */
  getConfig() {
    return apiClient.get<NetatmoConfigStatus>('/netatmo/config');
  },

  /** Enregistre les credentials de l'app Netatmo (secret chiffré en base). */
  saveConfig(payload: UpdateNetatmoConfigPayload) {
    return apiClient.put<NetatmoConfigStatus>('/netatmo/config', payload);
  },

  /** Modules Netatmo découverts (station météo) pour le wizard d'ajout. */
  getDevices() {
    return apiClient.get<NetatmoModule[]>('/netatmo/devices');
  },

  /** Thermostats / vannes Netatmo découverts pour le wizard d'ajout. */
  getThermostats() {
    return apiClient.get<NetatmoModule[]>('/netatmo/thermostats');
  },

  /** Modules sécurité Netatmo (détecteur fumée, door tags) pour le wizard d'ajout. */
  getSecurity() {
    return apiClient.get<NetatmoModule[]>('/netatmo/security');
  },
};
