/**
 * Client API frontend pour l'integration Odoo.
 * Pattern identique a pennylaneApi.ts.
 *
 * Endpoints backend :
 *   - POST   /api/odoo/connect      : sauvegarder une connexion (test + chiffrement)
 *   - GET    /api/odoo/status       : etat connexion courante
 *   - POST   /api/odoo/disconnect   : supprimer la connexion
 *
 * L'API key n'est JAMAIS retournee par le backend (elle est chiffree et
 * seulement utilisee en interne pour les calls Odoo).
 */
import { API_CONFIG } from '../../config/api';
import { getItem, STORAGE_KEYS } from '../storageService';

function getAccessToken(): string | null {
  return getItem(STORAGE_KEYS.ACCESS_TOKEN);
}

export interface OdooConnectionRequest {
  serverUrl: string;
  databaseName: string;
  userLogin: string;
  apiKey: string;
}

export interface OdooStatus {
  connected: boolean;
  serverUrl?: string | null;
  databaseName?: string | null;
  userLogin?: string | null;
  status?: string | null;
  lastTestedAt?: string | null;
  connectedAt?: string | null;
}

async function fetchJson<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_CONFIG.BASE_URL}${API_CONFIG.BASE_PATH}${endpoint}`;
  const token = getAccessToken();

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const error: Error & { status?: number; body?: unknown } = new Error(`Erreur ${response.status}`);
    error.status = response.status;
    try { error.body = await response.json(); } catch { /* ignore */ }
    throw error;
  }

  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return undefined as T;
  }
  return response.json();
}

export const odooApi = {
  /** Teste les credentials et sauvegarde si OK. Throws si echec. */
  async connect(req: OdooConnectionRequest): Promise<OdooStatus> {
    return fetchJson('/odoo/connect', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  },

  async getStatus(): Promise<OdooStatus> {
    return fetchJson('/odoo/status');
  },

  async disconnect(): Promise<{ disconnected: boolean; message?: string }> {
    return fetchJson('/odoo/disconnect', { method: 'POST' });
  },
};
