/**
 * Client API Xero — symetrique a {@link quickbooksApi.ts} / {@link docusignApi.ts}.
 * Routes /api/xero/{connect,callback,status,disconnect}.
 *
 * Cote backend, Xero utilise le meme OAuthFlowEngine que Pennylane / DocuSign /
 * QuickBooks — zero duplication de la logique OAuth.
 */
import { API_CONFIG } from '../../config/api';
import { getAccessToken } from '../../keycloak';

export interface XeroStatus {
  connected: boolean;
  connectedAt?: string;
  scopes?: string;
  tenantId?: string;
  tenantName?: string;
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

export const xeroApi = {
  async connect(): Promise<{ authorization_url?: string; status: string; message?: string }> {
    return fetchJson('/xero/connect');
  },

  async disconnect(): Promise<void> {
    await fetchJson<void>('/xero/disconnect', { method: 'POST' });
  },

  async getStatus(): Promise<XeroStatus> {
    return fetchJson('/xero/status');
  },
};
