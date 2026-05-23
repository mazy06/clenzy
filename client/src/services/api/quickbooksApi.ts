/**
 * Client API QuickBooks Online — symetrique a {@link docusignApi.ts}.
 * Routes /api/quickbooks/{connect,callback,status,disconnect}.
 *
 * Cote backend, QuickBooks utilise le meme moteur OAuthFlowEngine que
 * Pennylane et DocuSign — zero duplication de la logique OAuth.
 */
import { API_CONFIG } from '../../config/api';
import { getAccessToken } from '../../keycloak';

export interface QuickBooksStatus {
  connected: boolean;
  connectedAt?: string;
  scopes?: string;
  realmId?: string;
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

export const quickbooksApi = {
  async connect(): Promise<{ authorization_url?: string; status: string; message?: string }> {
    return fetchJson('/quickbooks/connect');
  },

  async disconnect(): Promise<void> {
    await fetchJson<void>('/quickbooks/disconnect', { method: 'POST' });
  },

  async getStatus(): Promise<QuickBooksStatus> {
    return fetchJson('/quickbooks/status');
  },
};
