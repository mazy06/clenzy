/**
 * Client API Sage Business Cloud Accounting — symetrique a quickbooksApi.ts.
 * Routes /api/sage/{connect,callback,status,disconnect}.
 *
 * Cote backend, Sage utilise le meme OAuthFlowEngine partage que les autres
 * providers OAuth (zero duplication).
 */
import { API_CONFIG } from '../../config/api';
import { getAccessToken } from '../../keycloak';

export interface SageStatus {
  connected: boolean;
  connectedAt?: string;
  scopes?: string;
  businessId?: string;
  businessName?: string;
  status?: string;
  errorMessage?: string;
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
    const error: Error & { status?: number } = new Error(`Erreur ${response.status}`);
    error.status = response.status;
    throw error;
  }

  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return undefined as T;
  }

  return response.json();
}

export const sageApi = {
  async connect(): Promise<{ authorization_url?: string; status: string; message?: string }> {
    return fetchJson('/sage/connect');
  },

  async disconnect(): Promise<void> {
    await fetchJson<void>('/sage/disconnect', { method: 'POST' });
  },

  async getStatus(): Promise<SageStatus> {
    return fetchJson('/sage/status');
  },
};
